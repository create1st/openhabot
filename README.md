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
npm install express body-parser node-wit http-status-codes --save

git clone https://github.com/create1st/openhabot
```

## Configuration

1. Create a new Facebook Page for your Bot https://www.facebook.com/pages/create
2. Create a new Facebook App for your Bot https://developers.facebook.com/quickstarts/?platform=web
3. Create account and install ngrok https://ngrok.com/download
4. Add product Messanger and set up Webhooks with http://serveo.net/ host. Check http://serveo.net/ for more details how to configure your own domain
5. Create Wit.Ai account

```
$ ./ssh -R mydomain:80:localhost:1337 serveo.net
```

* Create *config.json*

```json
{
	"port":"1337",
	"accessToken": "FB_PAGE_ACCESS_TOKEN",
	"verifyToken": "USER_RANDOM_VERIFICATION_TOKEN",
	"appSecret": "FB_APPLICATION_SECRET",
	"witAccessToken": "WIT_AI_ACCESS_TOKEN",
	"authorizedSenders": ["YOUR_FACEBOOK_NUMBER_ID"],
	"confidenceLevel": "0.77",
	"language": "en",
	"openHabRestUri": "http://127.0.0.1:8080/rest"
}
```
* Create *sitemap.json*
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

* Create *dictionary_{language_id}.json* for your language
```json
{
	"unauthorized": "You are not authorized to use this service. Your id has been recorded.",
	"unsupported_message_type": "I don't understand. How can I help you?",
	"openhab_error": "OpenHab error: %s",
	"wit_error": "Wit.Ai error: %s",
	"unrecognized_command": "I don't understand. Please be more precise",
	"get_value": "The value is %s",
	"get_value_undefined": "The value is undefined",
	"set_value": "Tha value has been set"
}
```
