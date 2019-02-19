<div align="center">    
 <img src="https://img.shields.io/github/license/create1st/openhabot.svg" align=left />
 <img src="https://img.shields.io/badge/openHAB-2.4.0-green.svg" align=left />
 <img src="https://img.shields.io/badge/node-%3E%3D%206.0.0-green.svg" align=left />
 <img src="https://img.shields.io/badge/PRs-welcome-green.svg" align=left />
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
* Add product Messanger and set up Webhooks with http://serveo.net/ host or create local ssh tunnel. Check http://serveo.net/ for more details how to configure your own domain in secure way. You can use http://ngrok.com or other alternatives

```
$ ./ssh -R mydomain:80:localhost:1337 serveo.net
```

* Create *config.json*
FB_PAGE_ACCESS_TOKEN - On Facebook application page: Products -> Messenger -> Token Generation -> (Select a page for you application or create a new one) -> generate token
FB_APPLICATION_SECRET - On Facebook application page: Settings -> Basic -> App Secret (push the show button)
USER_RANDOM_VERIFICATION_TOKEN - Type whatever you want. This has to match the webhook verification token specified on Facebook application page: Products -> Webhooks -> Edit Subscription -> Verify Token
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
* Create Wit.Ai entities and roles https://wit.ai/docs/quickstart (you can find my entities created for polish language at https://wit.ai/create1st/OpenHaBot/entities). Although you can use entities only it is recommended to use both entities and roles. Entities does specify the group, e.g. openhab_location and role does specify particular real world object, e.g. openhab_location_sleeping_room. You may decide to use openhab_location and openhab_settings for entities or decide to use anything you like, however you have to use openhab_set and openhab_get for definition of the keywords related to querying item state and setting a new one. Those are mandatory and have to be present in each definition. At the moment setting a value is limited to numbers (e.g. you cannot toggle the switch, this is still under development) which shall be mapped to wit/number
* Create *sitemap.json* to map the items you want to control with OpenHaBot. The mapping has to follow the schema: location (Wit.Ai rule name) -> setting (Wit.Ai rule name) -> operation (get_value or set_value) which maps to particular OpenHab item. In case when item is read-write item then it has to be exposed on both get_value and set_value. For items which are querried without the location the schema is as follows setting (Wit.Ai rule name) -> operation (get_value or set_value). You can add any nesting levels as you need, e.g. level/florr (Wit.Ai rule name) -> location (Wit.Ai rule name) -> setting (Wit.Ai rule name) -> operation (get_value or set_value).
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
	}
}
```
Keys in json are Wit.Ai entities/roles which do structure a look up path for OpenHab item. e.g. entries from Wit.Ai look up can look like:

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

* Update your \*.items files and add HTTP Binding channel (Http Binding has to be installed on OpenHab) for the items you want to be notified. It is important to notice that path in HTTP binding URI must match the item name
```
Group Vacuum "Odkurzacz" <House> [ "Vacuum" ]
String neato_vacuumcleaner_neato_state "Bobik status" <text> (Vacuum) {channel="neato:vacuumcleaner:neato:state",http=">[CHANGED:POST:http://127.0.0.1:1338/rest/items/neato_vacuumcleaner_neato_state/state/?state=%2$s]"}
String neato_vacuumcleaner_neato_error "Bobik error" <error> (Vacuum) {channel="neato:vacuumcleaner:neato:error",http=">[CHANGED:POST:http://127.0.0.1:1338/rest/items/neato_vacuumcleaner_neato_error/state/?state=%2$s]"}
Switch neato_vacuumcleaner_neato_is_docked "Bobik docked" <lock> (Vacuum) {channel="neato:vacuumcleaner:neato:is-docked",http=">[CHANGED:POST:http://127.0.0.1:1338/rest/items/neato_vacuumcleaner_neato_is_docked/state/?state=%2$s]"}

```

* Create *dictionary_{language_id}.json* for your language
```json
{
	"error": {
		"unauthorized": "You are not authorized to use this service. Your id has been recorded.",
		"unsupported_message_type": "Nie rozumiem. Jak mogę Ci pomóc?",		
		"openhab_call_failed": "Błąd systemu OpenHab: %s",
		"wit_call_failed": "Błąd systemu NLP Wit.Ai: %s"
	},
	"message": {
		"unrecognized_command": "Nie rozumiem. Możesz wyrazić się jaśniej?",
		"get_value": "Odczytano wartość %s",
		"get_value_undefined": "Odczytana wartość jest nieustawiona",
		"set_value": "Wprowadzono nowe ustawienia",
		"update": "%s zmienił stan na %s"		
	},
	"state": {
		"ERROR": "błąd",
		"BUSY": "zajęty",
		"IDLE": "bezczynny",
		"ON": "włączony",
		"OFF": "wyłączony"
	}
}
```

* Start the OpenHaBot application
```
node .
```

* Optionally you can configure OpenHaBot to start at system boot
  * Create a startup script in /etc/init.d
  * Updare rc.d
```
sudo update-rc.d /etc/init.d/<your script> defaults
```
