const HEADER_MESSAGES = [
  "Send a penny for their thoughts!",
  "Show your support!",
  "Send a token of your appreciation!",
  "Thank someone for their work!",
  "Send your compliments to the chef!",
  "Give someone your 2 cents!"
];
const CB_VERSION = '2018-10-09';

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
  return function (two_factor_token) {
    let headers = {
      'Authorization': `Bearer ${coinbase_access_token}`,
      'CB-VERSION': CB_VERSION,
    };

    if (two_factor_token) {
      headers['CB-2FA-TOKEN'] = two_factor_token
    }

    return $.ajax({
      url: `https://api.coinbase.com/v2/accounts/${account_id}/transactions`,
      data: {type: 'send', to: address, amount, description, currency, idem},
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
    $('#cb_message').text(`Sent ${response.responseJSON.details.subtitle}! Hash: ${response.responseJSON.network.hash}`);
    $('#cb_message_container').show().fadeOut(1000, function () {
      window.close();
    });
  }).fail(function (response) {
    clearView();
    let html = $.parseHTML(`Error: ${response.responseJSON.errors[0].message}`);
    $('#cb_message').append(html);
    $('#cb_message_container').show()
    // .fadeOut(1500, function() {
    //   $('#cb_submit_transaction_container').show();
    // });
  });
}

function sendTransaction(e) {
  e.preventDefault();
  clearView();
  $('.loader').show();

  setPartialTransactionFunction();

  // Never expecting this first function to return a successful response due to mandated 2 factor authentication
  // for the wallet:transactions:send scope
  partialTransactionFunction('').fail(function (response) {
    clearView();
    if (response.status === 402) {
      $('#cb_submit_2fa_button').bind('click', submit2FACode);
      $('#cb_2fa_verification_container').show();
    } else {
      let html = $.parseHTML(`Error: ${response.responseJSON.errors[0].message}`);
      $('#cb_message').append(html);
      $('#cb_message_container').show()
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
  clearTokens();
  clearView();
  $('#cb_message').text('Revoked!');
  $('#cb_message_container').show().fadeOut(1000, function () {
    $('#cb_signin_container').show();
  });
}

function clearTokens() {
  chrome.storage.local.remove(['coinbase_access_token', 'coinbase_refresh_token']);
  coinbase_access_token = undefined;
  coinbase_refresh_token = undefined;
}

function getAccounts() {
  $.ajax({
    url: 'https://api.coinbase.com/v2/accounts',
    type: 'GET',
    headers: {
      'Authorization': `Bearer ${coinbase_access_token}`,
      'CB-VERSION': CB_VERSION,
    },
    success: function (response) {
      let currencies = response.data;

      for (let i = 0; i < currencies.length - 1; i++) {
        let c = currencies[i];
        if (parseFloat(c.balance) > 0) {
          $('#currencies_dropdown').append(`<option value="${c.id}_${c.balance.currency}">${c.balance.amount} ${c.balance.currency}</option>`);
        }
      }
      clearView();
      showTransactionForm();
    },
    error: function (error) {
      clearView();
      if (error.status === 401 && coinbase_refresh_token) {
        $('#cb_message').text(`Token invalid. Refresh Token?`);
        $('#cb_refresh_token_button').bind('click', sendRefreshTokenMessage).show();
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

function sendRefreshTokenMessage(e) {
  e.preventDefault();
  clearView();
  $('.loader').show();

  chrome.runtime.sendMessage({directive: 'refresh_token'}, function(response) {
    if (response.result === 'token_refreshed') {
      coinbase_access_token = response.access_token;
      coinbase_refresh_token = response.refresh_token;
      clearView();
      $('#cb_refresh_token_button').hide();
      $('#cb_message').text('Refreshed!');
      $('#cb_message_container').show().fadeOut(1000, function () {
        getAccounts();
      });
    } else if(response.result === 'error_refreshing_token') {
      clearView();
      $('#cb_message').text(`Error refreshing token. Try signing in again.`);
      clearTokens();
      $('#cb_message_container').show().fadeOut(1500, function () {
        $('#cb_signin_container').show();
      });
    }
  });
}

function sendRevokeTokenMessage(e) {
  e.preventDefault();
  clearView();
  $('.loader').show();
  chrome.runtime.sendMessage({directive: 'revoke_token'}, function(response) {
    if (response.result === 'token_revoked') {
      onSuccessfulTokenRevocation();
    }
  });
}

function calculateExchangeRates() {
  let exchangeRates;
  let amount = parseFloat($('#cb_amount').val());
  let selectedCurrency = $('#currencies_dropdown').children('option:selected').val().split('_')[1];
  if (!selectedCurrency || !amount) {
    return $('#cb_converted_amount').text('');
  }

  $.ajax({
    url: `https://coinbase-staging.cbhq.net/api/v2/exchange-rates?currency=${selectedCurrency}`,
    data: {token: coinbase_access_token},
    type: 'GET',
  }).done(function (response) {
    exchangeRates = response.data.rates;
    let convertedAmount = (parseFloat(amount) * parseFloat(exchangeRates['USD'])).toFixed(2);
    $('#cb_converted_amount').text(`${amount} ${selectedCurrency} is about ${convertedAmount} USD`);
  });
}

window.onload = $(function () {
  randomlyGenerateFormMessage();
  $('#cb_signin').bind('click', sendSigninMessage);
  $('#cb_revoke_token_access_button').bind('click', sendRevokeTokenMessage);
  $('#cb_submit_transaction_button').bind('click', sendTransaction);
  $('#cb_amount').keyup(calculateExchangeRates);
  $('#currencies_dropdown').change(calculateExchangeRates);

  if (coinbase_access_token !== undefined) {
    $('.loader').show();
    getAccounts();
  } else {
    showSigninView();
  }
});
