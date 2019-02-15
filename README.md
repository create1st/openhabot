<div align="center">    
 <img src="https://img.shields.io/github/license/create1st/openhabot.svg" align=left />
 <img src="https://img.shields.io/badge/openHAB-2.4.0-green.svg" align=left />
 <img src="https://img.shields.io/badge/node-%3E%3D%206.0.0-green.svg" align=left />
 <img src="https://img.shields.io/badge/PRs-welcome-green.svg" align=left />
</div>

# Openhabot
This is NodeJS based implementation of openHAB Bot for Facebook Messenger

## Installation
```
npm install express body-parser --save 

git clone https://github.com/create1st/openhabot
```

## Congiguration

1. Create a new Facebook Page for your Bot https://www.facebook.com/pages/create
2. Create a new Facebook App for your Bot https://developers.facebook.com/quickstarts/?platform=web
3. Create account and install ngrok https://ngrok.com/download
4. Add product Messanger and set up Webhooks with ngrok host
5. Create Wit.Ai account

```
$ ./ngrok authtoken NGROK_AUTH_TOKEN
$ ./ngrok http 1337
```

* Create *config.json*

```json
{
	"port":"1337",
	"accessToken": "FB_PAGE_ACCESS_TOKEN",
	"verifyToken": "USER_RANDOM_VERIFICATION_TOKEN",
	"appSecret": "FB_APPLICATION_SECRET",
	"witAccessToken": "WIT_AI_ACCESS_TOKEN"
	"authorizedSenders": ["YOUR_FACEBOOK_NUMBER_ID"]
}
```
