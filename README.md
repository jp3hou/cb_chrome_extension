# CB Chrome Extension

## About

This is a Chrome extension that makes sending crypto payments easier and more accessible by integrating a payment flow
into your existing web browsing experience.

It uses OAuth2 to authenticate your Coinbase account. After logging in, you can select one of your Coinbase wallets
 and use it to make payments as you browse the web.

An increasing number of content creators, businesses, charities, and more are opting to accept crypto payments
online and publishing their currency account addresses on their websites for visitors.

Instead of having to switch between tabs or reach for your phone every time you come across such an address
on a site you would like to support, you can simply copy that address, pop open this Chrome extension, specify how much
you would like to send, and submit.

Payments to on-chain addresses (outside the Coinbase ecosystem) will incur small network fees;
however, payments to other Coinbase users are free. Instead of typing in an account address, just type in the email address
associated with the Coinbase account of the user you are sending this payment to.

## Security

You may configure a daily spending limit for your wallet during the sign-in process. The default limit is $1 USD.

Each transaction must be verified with the 2-factor authentication method you set up on your Coinbase account.
Upon authentication, this extension will receive and store an access token and a refresh token in your browser's
local storage.

The access token expires every two hours, but you will have the option to refresh your credentials with the refresh token.

You may revoke all token access at any time by clicking the "Log Out" button in the Options tab.


## Setup

1. Clone this repository onto your local computer
2. Navigate to chrome://extensions in your (Chrome) browser and toggle "Developer mode" in the top right corner
3. Click on the "Load unpacked" button in the toolbar that pops up
4. Select your newly cloned repository and click "Select"

A local version of this extension should appear in the list of your installed extensions.
Make sure the toggle switch is on to activate it, and it should appear in the top right corner
along with the rest of your extensions. Take note of the extension ID.

5. Go into your Coinbase settings page under "API Access" and click "New Oauth2 Application".
Fill out the application details such as name, description, etc.
For the redirect_uri, copy the value of the REDIRECT_URI constant in the `js/oauth.js` file
and replace the ID in the URI with the ID of your local extension.
6. Click save to add your new Coinbase application. You should see a page telling you the CLIENT_ID and CLIENT_SECRET values of this application.
7. Replace the CLIENT_ID and CLIENT_SECRET values in `js/oauth.js` with those values.
8. That's it! You should be able to click on the extension and start exploring its functionality.


## Contribute

Any suggestions? Make a pull request! Thank you in advance for your time.
