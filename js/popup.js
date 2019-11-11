const CLIENT_ID = 'd3a57b32056172fc74b8e46436ac08e3082aef663aaaf4f3ab6b396f882dcef7';
const REDIRECT_URI = 'https://aliafefgjbgnlfcjhdklhieafeheaoaj.chromiumapp.org/redirect_uri';
const HEADER_MESSAGES = ["Send your compliments to the chef!", "Give a token of your appreciation!"];
const CLIENT_SECRET = 'b7511f2e5aa9b3566bce12f767727bc52f41a40a0263bbbd53a37016061948e1';

let coinbase_access_token;
chrome.storage.local.get(['coinbase_access_token'], function (result) {
  coinbase_access_token = result.coinbase_access_token;
});

function signIn() {
  let url = `https://www.coinbase.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}` +
    '&response_type=code&scope=wallet:user:read,wallet:accounts:read';
  chrome.identity.launchWebAuthFlow(
    {
      'url': url,
      'interactive': true
    },
    function (redirect_url) {
      alert(redirect_url);
      if (chrome.runtime.lastError && chrome.runtime.lastError.message === "The user did not approve access.") {
        showUnsuccessfulSigninView();
      } else {
        validateRedirectUri(redirect_url);
        showSuccessfulSigninView();
      }
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
    }, function(response) {
      chrome.storage.local.set({ 'coinbase_access_token': response.access_token, 'coinbase_refresh_token': response.refresh_token })
    });
  } else {
    showUnsuccessfulSigninView();
  }
}

function randomlyGenerateFormMessage() {
  let msg = HEADER_MESSAGES[Math.floor(Math.random() * HEADER_MESSAGES.length)];
  $('#cb_submission_form_message').text(msg).val();
}

function sendTransaction() {
  alert('sending transaction!');
}

function showSuccessfulSigninView() {
  $('#cb_signin_container').hide();
  $('#cb_submit_transaction_button').bind("click", sendTransaction);
  $('#cb_signin_result_message').text('Successfully signed in!').val();
  $('#cb_signin_result_container').show().fadeOut(1000, function () {
    $('#cb_submit_transaction_container').fadeIn(500);
  });
}

function showSignedInView() {
  $('#cb_submit_transaction_button').bind("click", sendTransaction);
  $('#cb_submit_transaction_container').show();
}

function showUnsuccessfulSigninView() {
  $('#cb_signin_result_message').text('Sign in failed :(').val();
  $('#cb_signin_result_container').show().fadeOut(1500, function () {
    $('#cb_signin_container').show().fadeIn(500);
  });
}

$(function () {
  randomlyGenerateFormMessage();

  if (coinbase_access_token !== undefined) {
    showSignedInView();
  } else {
    $('#cb_signin').bind("click", signIn);
    $('#cb_signin_container').show();
  }
});
