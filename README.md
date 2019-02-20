<div align="center">    
 <img src="https://img.shields.io/github/license/create1st/openhabot.svg" align="left" />
 <img src="https://img.shields.io/badge/openHAB-2.4.0-green.svg" align="left" />
 <img src="https://img.shields.io/badge/node-%3E%3D%206.0.0-green.svg" align="left" />
 <img src="https://img.shields.io/badge/PRs-welcome-green.svg" align="left" />
</div>

# OpenHaBot
This is NodeJS based implementation of openHAB Bot for Facebook Messenger

## Installation
```
npm install express body-parser node-wit http-status-codes lodash --save

git clone https://github.com/create1st/openhabot
```

## Configuration

* Create a new Facebook Page for your Bot https://www.facebook.com/pages/create
* Create a new Facebook App for your Bot https://developers.facebook.com/quickstarts/?platform=web You have to set up Privacy Policy and provide the URL. You can have one for free from https://www.iubenda.com
* in Facebook App add a product *Messanger*  for which you will create a *webhook* once the bot is started for a very first time
* Set up a secured ssh tunnel for your Facebook webhook. You can use http://serveo.net/ Check their web site for more details how to configure your own domain in a secure way. You can use http://ngrok.com or other alternatives as well

```
$ ./ssh -R mydomain:80:localhost:1337 serveo.net
```

* Create *config.json*
  * **FB_PAGE_ACCESS_TOKEN** - On Facebook application page: **Products** -> **Messenger** -> **Token Generation** -> (Select a page for you application or create a new one) -> **generate token**
  * **FB_APPLICATION_SECRET** - On Facebook application page: **Settings** -> **Basic** -> **App Secret** (push the show button)
  * **USER_RANDOM_VERIFICATION_TOKEN** - Type whatever you want
  * **WIT_AI_ACCESS_TOKEN** - On Wit.Ai application page: **Settings** -> **API Details** -> **Server Access Token**
  * **authorizedSenders** - Your facebook id and ids of other user who shall be peritted to execute commands. You can leave it empty and that would mean anybody is going to access the page. Since the app is by default set in development mode this means only you will have the access to it. However if you leave it empty you are not going to receive any notifications. If you do not know what is your Facebook id then put here anything and on first chat the system will respond with it and message that you are not authorized.
  * **confidenceLevel** - depending on quality of your rules and particular language gramma complexity Wit.Ai can guess the entities with some confidence. The confidence level configured in config acts as a threshold under which we consider that the Wit.Ai evaluation was correct or not.
  * **language** - this one is important as you need to have a dictionary json file suffixed with language id you have specified here
```json
{
	"webhookPort": "1337",
	"accessToken": "FB_PAGE_ACCESS_TOKEN",
	"verifyToken": "USER_RANDOM_VERIFICATION_TOKEN",
	"appSecret": "FB_APPLICATION_SECRET",
	"witAccessToken": "WIT_AI_ACCESS_TOKEN",
	"authorizedSenders": ["YOUR_FACEBOOK_NUMBER_ID"],
	"confidenceLevel": "0.77",
	"language": "en",
	"openHabRestUri": "http://127.0.0.1:8080/rest",
	"openHabHttpBindingPort": "1338"
}
```
* Create Wit.Ai account
* Create Wit.Ai entities and roles https://wit.ai/docs/quickstart (you can find my entities created for polish language at https://wit.ai/create1st/OpenHaBot/entities). Although you can use only entities, it is recommended to use both entities and roles. Entities does specify the group, e.g. *openhab_location* and role does specify particular real world object, e.g. *openhab_location_sleeping_room*. You may decide to use *openhab_location* and *openhab_settings* for entities or decide to use anything you like, however you have to use *openhab_set* and *openhab_get* for definition of the keywords related to querying item value and setting a new one. Setting a value is limited to the numbers which shall be mapped to *wit/number*. All the states related to toggling a switch or execution a command are mapped to *openhab_operation* and state. To have better understanding check next section related to *sitemap.json* definition
* Create *sitemap.json* to map the items you want to control with OpenHaBot. The mapping has to follow the schema: **location** or **thing** (Wit.Ai rule name) -> **setting** (Wit.Ai rule name) -> **operation** (get_value, set_value or openhab_command) which maps to particular OpenHab item.
  * **get_value** shall be mapped to particular item keyword in Wit.Ai. This is to read item state, e.g. **what is the temperature in the living room?**
  * **set_value** shall be mapped to particular item keyword in Wit.Ai. This is to set **numeric** item state, **set the temperature in the living room to 23 degrees**
  * Setting the state of items of type string, switch, etc. is achieved via **openhab_command** which does not have direct mapping in Wit.Ai. What is mapped is the location and/or thing symbolic name, the operation (e.g. "cleaning") and desired state (e.g. start/stop/on/off). It is imporatant to notice that some particular states which are defined by vendor do not match language semantics, e.g. Neato robots have command channel which do accepts states: *clean*, *stop*, *pause*, *resume*, *dock*. In this example we do have two language specific issues. First is state *clean* which for "cleaning" operation means nothing. We do not want to have commands like **neato, clean cleaning**. Meaningful from language point of view are commands like: **neato, start cleaning**, **neato, stop cleaning**, etc. So first thing we need to do is to create mappings which will recognize *start* and transforms it to *clean* which is understood by OpenHab Neato binding. Second issue with Neato accepted states is state *dock*. It is unrelated to cleaning operation. We do not want to have constructions like **neato, clean the dock**. Therefore we should create separate operation "return" for the same command itemwhich will accept the state *dock*, so we can say **neato, return to the dock**. To ilustrate the problem and possible solution check Alexa skills and command examples https://www.amazon.com/Neato-Robotics/dp/B01MXI58Y7?tag=hawk-future-20&ascsubtag=tomsguide
  Please check also sample *sitemap.json*
```json
{
	"openhab_location_workplace_room": {
		"openhab_settings_temperature": {
			"openhab_set": "zwave_device_id_node2_thermostat_setpoint_heating"
		}
	},
	"openhab_location_bathroom_first_floor": {
		"openhab_settings_temperature": {
			"openhab_set": "zwave_device_id_node3_thermostat_setpoint_heating"
		}
	},
	"openhab_location_sleeping_room": {
		"openhab_settings_temperature": {
			"openhab_get": "mihome_sensor_ht_1_temperature",
			"openhab_set": "zwave_device_id_node4_thermostat_setpoint_heating"
		},
		"openhab_settings_humidity": {
			"openhab_get": "mihome_sensor_ht_1_humidity"
		}
	},
	"openhab_location_living_room": {
		"openhab_settings_temperature": {
			"openhab_get": "mihome_sensor_ht_2_temperature",
			"openhab_set": "zwave_device_id_node5_thermostat_setpoint_heating"
		},
		"openhab_settings_humidity": {
			"openhab_get": "mihome_sensor_ht_2_humidity"
		}	
	},
	"openhab_location_studio_room": {
		"openhab_settings_temperature": {
			"openhab_set": "zwave_device_id_node6_thermostat_setpoint_heating"
		}
	},
	"openhab_location_corridor": {
		"openhab_settings_light": {
			"openhab_command": "mihome_gateway_1_lightSwitch",
			"values": ["on", "off"]
		}
	},
	"openhab_thing_neato": {
		"openhab_operation_cleaning": {
			"openhab_command": "neato_vacuumcleaner_neato_command",
			"values": ["start", "stop", "pause", "resume"],
			"mappings": {
				"start": "clean"
			}
		},
		"openhab_operation_return": {
			"openhab_command": "neato_vacuumcleaner_neato_command",
			"values": ["dock"]
		}
	}
}
```
Keys in json are Wit.Ai entities/roles which do structure a look up path for OpenHab item. Example outcome from Wit.Ai look up can be like:

```javascript
{ openhab_set:
   [ { confidence: 0.77588039802196, value: 'ustaw', type: 'value' },
     [length]: 1 ],
  openhab_settings_temperature:
   [ { confidence: 0.84355505856879,
       value: 'temperaturę',
       type: 'value' },
     [length]: 1 ],
  openhab_location_sleeping_room:
   [ { confidence: 0.77086080572739,
       value: 'sypialni',
       type: 'value' },
     [length]: 1 ],
  number: [ { confidence: 1, value: 23, type: 'value' }, [length]: 1 ],
  openhab_unit_degree:
   [ { confidence: 0.61746979290351, value: 'stopnie', type: 'value' },
     [length]: 1 ] }
```

* Update your \*.items files and add HTTP Binding channel (Http Binding has to be installed on OpenHab) for the items you want to be notified. It is important to notice that path in HTTP binding URI must match the item name, e.g. item with name **neato_vacuumcleaner_neato_error** uses the channel http\://127.0.0.1:1338/rest/items/**neato_vacuumcleaner_neato_error**/state/?state=%2$s
```
Group Vacuum "Odkurzacz" <House> [ "Vacuum" ]
String neato_vacuumcleaner_neato_state "Bobik status" <text> (Vacuum) {channel="neato:vacuumcleaner:neato:state",http=">[CHANGED:POST:http://127.0.0.1:1338/rest/items/neato_vacuumcleaner_neato_state/state/?state=%2$s]"}
String neato_vacuumcleaner_neato_error "Bobik error" <error> (Vacuum) {channel="neato:vacuumcleaner:neato:error",http=">[CHANGED:POST:http://127.0.0.1:1338/rest/items/neato_vacuumcleaner_neato_error/state/?state=%2$s]"}
Switch neato_vacuumcleaner_neato_is_docked "Bobik docked" <lock> (Vacuum) {channel="neato:vacuumcleaner:neato:is-docked",http=">[CHANGED:POST:http://127.0.0.1:1338/rest/items/neato_vacuumcleaner_neato_is_docked/state/?state=%2$s]"}
String neato_vacuumcleaner_neato_command "Bobik command" <text> (Vacuum) {channel="neato:vacuumcleaner:neato:command"}
```

* Create *dictionary_{language_id}.json* for your language
```json
{
	"error": {
		"unauthorized": "You are not authorized to use this service. Your id %s has been recorded.",
		"unsupported_message_type": "I don't understand. How can I help you?",
		"openhab_call_failed": "OpenHab error: %s",
		"wit_call_failed": "Wit.Ai error: %s"
	},
	"message": {
		"unrecognized_command": "I don't understand. Please be more precise",
		"get_value": "The value is %s",
		"get_value_undefined": "The value is undefined",
		"set_value": "Cofirmed",
		"update": "%s has changed the state to %s"
	},
	"state": {
		"OFFLINE": "offline",
		"ERROR": "error",
		"BUSY": "busy",
		"IDLE": "idle",
		"ON": "on",
		"OFF": "off"
	}
}
```

* Start the OpenHaBot application
```
node .
```
* Create Facebook Webhook. **Products** -> **Webhooks** -> **Edit Subscription**. Use your serveo.com webhook tunnel address and **Verify Token** which you have specified in *config.json* as **USER_RANDOM_VERIFICATION_TOKEN**

* Optionally you can configure OpenHaBot to start at system boot
  * Create a startup script in /etc/init.d
  * Updare rc.d
```
sudo update-rc.d /etc/init.d/<your script> defaults
```
