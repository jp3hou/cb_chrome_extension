const CLIENT_ID = 'd3a57b32056172fc74b8e46436ac08e3082aef663aaaf4f3ab6b396f882dcef7';
const REDIRECT_URI = 'https://aliafefgjbgnlfcjhdklhieafeheaoaj.chromiumapp.org/redirect_uri';
const CLIENT_SECRET = 'b7511f2e5aa9b3566bce12f767727bc52f41a40a0263bbbd53a37016061948e1';

let coinbase_access_token;
let coinbase_refresh_token;

chrome.storage.local.get(['coinbase_access_token', 'coinbase_refresh_token'], (result) => {
  if (!chrome.runtime.lastError) {
    coinbase_access_token = result.coinbase_access_token;
    coinbase_refresh_token = result.coinbase_refresh_token;
  }
});

const onReceivedRedirectUrl = (redirect_url) => {
  if (!chrome.runtime.lastError) {
    validateRedirectUri(redirect_url);
  }
};

const signIn = () => {
  $('#cb_signin_container').hide();
  $('.loader').show();

  let url = `https://www.coinbase.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}` +
    '&response_type=code&scope=wallet:accounts:read,wallet:addresses:create,wallet:transactions:send&meta[send_limit_amount]=1&meta[send_limit_currency]=USD&meta[send_limit_period]=day';
  chrome.identity.launchWebAuthFlow(
    {
      'url': url,
      'interactive': true
    }, onReceivedRedirectUrl);
};

const onSuccessfulOAuthHandshake = (response) => {
  chrome.storage.local.set({
    'coinbase_access_token': response.access_token,
    'coinbase_refresh_token': response.refresh_token
  });
  coinbase_access_token = response.access_token;
  coinbase_refresh_token = response.refresh_token;
  chrome.notifications.create({
    type: 'basic',
    title: 'Signed In!',
    iconUrl: 'images/icon48.png',
    message: 'You have successfully signed into your Coinbase Account!'
  });
};

const validateRedirectUri = async (redirect_uri) => {
  let regex = new RegExp(REDIRECT_URI);
  let code;
  if (redirect_uri.match(regex)) {
    code = redirect_uri.split('code=')[1];
    try {
      let results = await $.post('https://api.coinbase.com/oauth/token', {
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
      });
      onSuccessfulOAuthHandshake(results);
    } catch (e) {
      chrome.notifications.create({
        type: 'basic',
        title: 'Signin failed',
        iconUrl: 'images/icon48.png',
        message: 'Failed to sign in to your Coinbase account :('
      });
    }
  }
};

const refreshToken = async (request, sender, sendResponse) => {
  try {
    let response = await $.post('https://api.coinbase.com/oauth/token', {
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: coinbase_refresh_token
    });

    chrome.storage.local.set({
      'coinbase_access_token': response.access_token,
      'coinbase_refresh_token': response.refresh_token
    });
    coinbase_access_token = response.access_token;
    coinbase_refresh_token = response.refresh_token;
    sendResponse({
      result: 'token_refreshed',
      access_token: response.access_token,
      refresh_token: response.refresh_token
    });
  } catch (e) {
    sendResponse({ result: 'error_refreshing_token', responseJSON: e.responseJSON });
  }
};

const revokeToken = async (request, sender, sendResponse) => {
  await $.ajax({
    url: 'https://api.coinbase.com/oauth/revoke',
    data: { token: coinbase_access_token },
    type: 'POST',
    headers: { 'Authorization': `Bearer ${coinbase_access_token}` }
  });
  removeTokens();
  sendResponse({ result: 'token_revoked' });
};

const removeTokens = () => {
  chrome.storage.local.remove(['coinbase_access_token', 'coinbase_refresh_token']);
  coinbase_access_token = undefined;
  coinbase_refresh_token = undefined;
};

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    switch (request.directive) {
      case 'initiate_oauth':
        signIn();
        break;
      case 'revoke_token':
        revokeToken(request, sender, sendResponse);
        return true; // signals that this call should be made asynchronously
      case 'refresh_token':
        refreshToken(request, sender, sendResponse);
        return true;
      default:
        sendResponse({});
        break;
    }
  }
);
