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
let partialTransactionFunction;

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

function sendTransactionCurried(account_id, currency, address, amount, description, idem) {
  return function(two_factor_token) {
    let headers = {
      'Authorization': `Bearer ${coinbase_access_token}`,
    };

    if (two_factor_token) {
      headers['CB-2FA-TOKEN'] = two_factor_token
    }

    return $.ajax({
      url: `https://api.coinbase.com/v2/accounts/${account_id}/transactions`,
      data: { type: 'send', to: address, amount, description, currency, idem },
      type: 'POST',
      headers: headers
    });
  }
}

// "freeze" the account id, currency, address, amount, description, and idem values in a partial function that is
// called twice, first without and then with a 2 factor authorization token in the headers
function setPartialTransactionFunction() {
  let account_id, currency;
  [account_id, currency] = $('#currencies_dropdown').children('option:selected').val().split('_');
  let address = $('#cb_recipient_address').val();
  let amount = $('#cb_amount').val();
  let description = $('#cb_trx_note').val();
  let idem = `cb_extension_${Date.now()}`;

  partialTransactionFunction = sendTransactionCurried(account_id, currency, address, amount, description, idem);
}

function submit2FACode(e) {
  e.preventDefault();
  clearView();
  $('.loader').show();

  partialTransactionFunction($('#cb_2fa_code').val()).done(function (response) {
    clearView();
    $('#cb_message').text(`Sent ${response.details.subtitle}! Hash: ${response.network.hash}`);
    $('#cb_message_container').show().fadeOut(1000, function() {
      window.close();
    });
  }).fail(function (response) {
    clearView();
    $('#cb_message').text(`Something went wrong. ${response.status}. Try again?`);
    $('#cb_message_container').show().fadeOut(1500, function() {
      $('#cb_submit_transaction_container').show();
    });
  });
}

function sendTransaction(e) {
  e.preventDefault();
  clearView();
  $('.loader').show();

  setPartialTransactionFunction();

  // Never expecting this first function to return a successful response due to mandated 2 factor authentication
  // for the wallet:transactions:send scope
  partialTransactionFunction('').fail(function(response) {
    clearView();
    if (response.status === 402) {
      $('#cb_submit_2fa_button').bind('click', submit2FACode);
      $('#cb_2fa_verification_container').show();
    } else {
      $('#cb_message').text(`Something went wrong. ${response.status}. Try again?`);
      $('#cb_message_container').show().fadeOut(1500, function() {
        $('#cb_submit_transaction_container').show();
      });
    }
  });
}

function clearView() {
  $('#cb_signin_container').hide();
  $('#cb_message_container').hide();
  $('#cb_submit_transaction_container').hide();
  $('#cb_2fa_verification_container').hide();
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
      $('#cb_refresh_token_button').hide();
      $('#cb_message').text('Refreshed!');
      $('#cb_message_container').show().fadeOut(1000, function () {
        getAccounts();
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
        $('#currencies_dropdown').append(`<option value="${c.id}_${c.balance.currency}">${c.balance.amount} ${c.balance.currency}</option>`);
      }

      clearView();
      showTransactionForm();
    },
    error: function (error) {
      clearView();
      if (error.status === 401 && coinbase_refresh_token) {
        $('#cb_message').text(`Token invalid. Refresh Token?`);
        $('#cb_refresh_token_button').bind('click', refreshToken).show();
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
