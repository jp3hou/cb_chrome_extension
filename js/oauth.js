const CLIENT_ID = 'd3a57b32056172fc74b8e46436ac08e3082aef663aaaf4f3ab6b396f882dcef7';
const REDIRECT_URI = 'https://aliafefgjbgnlfcjhdklhieafeheaoaj.chromiumapp.org/redirect_uri';
const CLIENT_SECRET = 'b7511f2e5aa9b3566bce12f767727bc52f41a40a0263bbbd53a37016061948e1';

function onReceivedRedirectUrl(redirect_url) {
  if (chrome.runtime.lastError && chrome.runtime.lastError.message === "The user did not approve access.") {
    showUnsuccessfulSigninView();
  } else {
    validateRedirectUri(redirect_url);
    showSuccessfulSigninView();
  }
}

function showSuccessfulSigninView() {
  $('#cb_signin_container').hide();
  $('.loader').hide();

  $('#cb_message').text('Successfully signed in!');
  $('#cb_message_container').show().fadeOut(1000, function () {
    $('#cb_submit_transaction_container').fadeIn(500);
  });
}

function showUnsuccessfulSigninView() {
  $('.loader').hide();

  $('#cb_message').text('Sign in failed :(');
  $('#cb_message_container').show().fadeOut(1500, function () {
    $('#cb_signin_container').show().fadeIn(500);
  });
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
    }, onSuccessfulOAuthHandshake, 'json');
  } else {
    showUnsuccessfulSigninView();
  }
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if(request.directive === 'initiate_oauth') {
      signIn();
      sendResponse({});
    }
  }
);
