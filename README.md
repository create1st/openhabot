# Openhabot
This is NodeJS based implementation of OpenHab Bot for Facebook Messenger

## Installation
```
npm install express body-parser --save 
npm install bootbot --savenpm install bootbot --save
git clone https://github.com/create1st/openhabot
```

## Congiguration

1. Create a new Facebook Page for your Bot https://www.facebook.com/pages/create
2. Create a new Facebook App for your Bot https://developers.facebook.com/quickstarts/?platform=web
3. Create account and install ngrok https://ngrok.com/download
4. Add product Messanger and set up Webhooks

```
$ ./ngrok authtoken NGROK_AUTH_TOKEN
$ ./ngrok http 1337
```

* Create *config.json*

```json
{
	"port":"1337",
	"accessToken":"FB_PAGE_ACCESS_TOKEN",
	"verifyToken":"USER_RANDOM_VERIFICATION_TOKEN",
	"appSecret":"FB_APPLICATION_SECRET"
}
```