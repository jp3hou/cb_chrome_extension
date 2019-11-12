const CLIENT_ID = 'd3a57b32056172fc74b8e46436ac08e3082aef663aaaf4f3ab6b396f882dcef7';
const CLIENT_SECRET = 'b7511f2e5aa9b3566bce12f767727bc52f41a40a0263bbbd53a37016061948e1';

const HEADER_MESSAGES = [
  "Send a penny for their thoughts!",
  "Show your support!",
  "Send a token of your appreciation!",
  "Thank someone for their work!",
  "Send your compliments to the chef!",
  "Give someone your 2 cents!"
];

let coinbase_access_token;
let coinbase_refresh_token;

chrome.storage.local.get(['coinbase_access_token', 'coinbase_refresh_token'], function (result) {
  if (!chrome.runtime.lastError) {
    coinbase_access_token = result.coinbase_access_token;
    coinbase_refresh_token = result.coinbase_refresh_token;
  }
});

function showSigninView() {
  $('#cb_submit_transaction_container').hide();
  $('#cb_signin_container').show();
}

function randomlyGenerateFormMessage() {
  let msg = HEADER_MESSAGES[Math.floor(Math.random() * HEADER_MESSAGES.length)];
  $('#cb_submission_form_message').text(msg);
}

function sendTransaction(e) {
  e.preventDefault();
  clearView();
  $('.loader').show();

  $.ajax({
    url: 'https://api.coinbase.com/v2/accounts/2bbf394c-193b-5b2a-9155-3b4732659ede/transactions',
    data: {
      type: 'send',
      to: '',
      amount: '',
      currency: 'BTC',
      idem: `cb_extension_${Date.now()}`,
    },
    type: "POST",
    headers: {'Authorization': `Bearer ${coinbase_access_token}`},
    success: function () {
      clearView();
      $('#cb_message').text('Sent!');
      $('#cb_message_container').show().fadeOut(1000);
    },
    error: function (error) {
      $('#cb_submit_transaction_form').hide();
      $('#cb_message').text(`Something went wrong: ${error.message}`);
    }
  });
}

function clearView() {
  $('#cb_signin_container').hide();
  $('#cb_message_container').hide();
  $('#cb_submit_transaction_container').hide();
  $('.loader').hide();

}
function onSuccessfulTokenRevocation() {
  chrome.storage.local.remove(['coinbase_access_token', 'coinbase_refresh_token']);
  clearView();
  $('#cb_message').text('Revoked!');
  $('#cb_message_container').show().fadeOut(1000, function () {
    $('#cb_signin_container').show();
  });
}

function revokeToken() {
  clearView();
  $('.loader').show();
  $.ajax({
    url: 'https://api.coinbase.com/oauth/revoke',
    data: {token: coinbase_access_token},
    type: 'POST',
    headers: {'Authorization': `Bearer ${coinbase_access_token}`},
    success: onSuccessfulTokenRevocation,
    error: function (error) {
    }
  });
}

function refreshToken () {
  clearView();
  $('.loader').show();
  $.ajax({
    url: 'https://api.coinbase.com/oauth/token',
    data: {
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: coinbase_refresh_token,
    },
    type: 'POST',
    success: function (response) {
      chrome.storage.local.set({
        'coinbase_access_token': response.access_token,
        'coinbase_refresh_token': response.refresh_token
      });
      coinbase_access_token = response.access_token;
      coinbase_refresh_token = response.refresh_token;
      clearView();
      $('#cb_message').text('Revoked!');
      $('#cb_message_container').show().fadeOut(1000, function () {
        $('#cb_submit_transaction_container').show();
      });
    },
    error: function (error) {
      clearView();
      $('#cb_message').text(`Error refreshing token. Status ${error.status}`);
      $('#cb_message_container').show();
    }
  });
}

function getAccounts() {
  $.ajax({
    url: 'https://api.coinbase.com/v2/accounts',
    type: 'GET',
    headers: {'Authorization': `Bearer ${coinbase_access_token}`},
    success: function (response) {
      let currencies = response.data;

      for (let i = 0; i < currencies.length - 1; i++) {
        let c = currencies[i];
        $('#currencies_dropdown').append(`<option val="${c.id}-${c.balance.currency}">${c.balance.amount} ${c.balance.currency}</option>`);
      }

      clearView();
      showTransactionForm();
    },
    error: function (error) {
      clearView();
      if (error.status === 401 && coinbase_refresh_token) {
        $('#cb_message').text(`Token invalid. Refresh Token?`);
        $('#cb_refresh_token_button').bind('click', refreshToken);
        $('#cb_refresh_token_button').show();
        $('#cb_message_container').show();

      } else {
        clearView();
        $('#cb_signin_container').fadeIn(1000);
      }
    }
  });
}

function showTransactionForm() {
  $('#cb_submit_transaction_container').show();
}

function sendSigninMessage(e) {
  e.preventDefault();
  chrome.runtime.sendMessage({directive: 'initiate_oauth'});
}

window.onload = $(function () {
  randomlyGenerateFormMessage();
  $('#cb_signin').bind('click', sendSigninMessage);
  $('#cb_revoke_token_access_button').bind('click', revokeToken);
  $('#cb_submit_transaction_button').bind('click', sendTransaction);

  if (coinbase_access_token !== undefined) {
    $('.loader').show();
    getAccounts();
  } else {
    showSigninView();
  }
});
