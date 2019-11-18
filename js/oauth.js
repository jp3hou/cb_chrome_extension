const CLIENT_ID = 'd3a57b32056172fc74b8e46436ac08e3082aef663aaaf4f3ab6b396f882dcef7';
const REDIRECT_URI = 'https://aliafefgjbgnlfcjhdklhieafeheaoaj.chromiumapp.org/redirect_uri';
const CLIENT_SECRET = 'b7511f2e5aa9b3566bce12f767727bc52f41a40a0263bbbd53a37016061948e1';

let coinbase_access_token;
let coinbase_refresh_token;

chrome.storage.local.get(['coinbase_access_token', 'coinbase_refresh_token'], function (result) {
  if (!chrome.runtime.lastError) {
    coinbase_access_token = result.coinbase_access_token;
    coinbase_refresh_token = result.coinbase_refresh_token;
  }
});

function onReceivedRedirectUrl(redirect_url) {
  if (!chrome.runtime.lastError) {
    validateRedirectUri(redirect_url);
  }
}

function signIn() {
  $('#cb_signin_container').hide();
  $('.loader').show();

  let url = `https://www.coinbase.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}` +
    '&response_type=code&scope=wallet:accounts:read,wallet:transactions:send&meta[send_limit_amount]=1&meta[send_limit_currency]=USD&meta[send_limit_period]=day';
  chrome.identity.launchWebAuthFlow(
    {
      'url': url,
      'interactive': true
    }, onReceivedRedirectUrl);
}

function onSuccessfulOAuthHandshake(response) {
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
}

function validateRedirectUri(redirect_uri) {
  let regex = new RegExp(REDIRECT_URI);
  let code;
  if (redirect_uri.match(regex)) {
    code = redirect_uri.split('code=')[1];
    $.post('https://api.coinbase.com/oauth/token', {
      grant_type: 'authorization_code',
      code: code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI
    }).done(onSuccessfulOAuthHandshake)
      .fail(function () {
        chrome.notifications.create({
          type: 'basic',
          title: 'Signin failed',
          iconUrl: 'images/icon48.png',
          message: 'Failed to sign in to your Coinbase account :('
        });
      });
  }
}

function refreshToken(request, sender, sendResponse) {
  $.post('https://api.coinbase.com/oauth/token', {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: coinbase_refresh_token
  }).done(function (response) {
    sendResponse({
      result: 'token_refreshed',
      access_token: response.access_token,
      refresh_token: response.refresh_token
    });
  }).fail(function (response) {
    sendResponse({result: 'error_refreshing_token', responseJSON: response.responseJSON});
  });
}

function revokeToken(request, sender, sendResponse) {
  $.ajax({
    url: 'https://api.coinbase.com/oauth/revoke',
    data: {token: coinbase_access_token},
    type: 'POST',
    headers: {'Authorization': `Bearer ${coinbase_access_token}`}
  }).done(function () {
    removeTokens();
    sendResponse({result: 'token_revoked'});
  });
}

function removeTokens() {
  chrome.storage.local.remove(['coinbase_access_token', 'coinbase_refresh_token']);
  coinbase_access_token = undefined;
  coinbase_refresh_token = undefined;
}

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    switch (request.directive) {
      case 'initiate_oauth':
        signIn();
        return true; // signals that this call should be made asynchronously
      case 'revoke_token':
        revokeToken(request, sender, sendResponse);
        return true;
      case 'refresh_token':
        refreshToken(request, sender, sendResponse);
        return true;
      default:
        sendResponse({});
        break;
    }
  }
);
