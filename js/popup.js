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

chrome.storage.local.get(['coinbase_access_token', 'coinbase_refresh_token'], (result) => {
  if (!chrome.runtime.lastError) {
    coinbase_access_token = result.coinbase_access_token;
    coinbase_refresh_token = result.coinbase_refresh_token;
  }
});

const ajaxRequest = (type, url, data = {}, headers = {}) => {
  headers = {
    ...headers,
    'Authorization': `Bearer ${coinbase_access_token}`,
    'CB-VERSION': CB_VERSION,
  };

  return $.ajax({ url, type, data, headers });
}
const showSigninView = () => {
  $('#cb_submit_transaction_container').hide();
  $('#cb_signin_container').show();
}

const randomlyGenerateFormMessage = () => {
  let msg = HEADER_MESSAGES[Math.floor(Math.random() * HEADER_MESSAGES.length)];
  $('#cb_submission_form_message').text(msg);
}

const sendTransactionCurried = (account_id, currency, address, amount, description, idem) => {
  return (two_factor_token) => {
    let headers = {};

    if (two_factor_token) {
      headers['CB-2FA-TOKEN'] = two_factor_token
    }

    return ajaxRequest(
      'POST',
      `https://api.coinbase.com/v2/accounts/${account_id}/transactions`,
      { type: 'send', to: address, amount, description, currency, idem },
      headers,
    );
  }
}

// "freeze" the account id, currency, address, amount, description, and idem values in a partial function that is
// called twice, first without and then with a 2 factor authorization token in the headers
const setPartialTransactionFunction = () => {
  let [account_id, currency] = $('#currencies_dropdown').children('option:selected').val().split('_');

  partialTransactionFunction = sendTransactionCurried(
    account_id,
    currency,
    $('#cb_recipient_address').val(),
    $('#cb_amount').val(),
    $('#cb_trx_note').val(),
    `cb_extension_${Date.now()}`,
  );
}

const isValidInput = () => {
  let [account_id, currency] = $('#currencies_dropdown').children('option:selected').val().split('_');

  return account_id && currency && $('#cb_recipient_address').val() && $('#cb_amount').val();
}

const submit2FACode = async (e) => {
  e.preventDefault();
  clearView();
  $('.loader').show();

  try {
    let response = await partialTransactionFunction($('#cb_2fa_code').val());
    clearView();
    let url = response.data.resource_path.split('/v2')[1];
    let message = $.parseHTML(`Sent ${Math.abs(parseFloat(response.data.amount.amount))} ${response.data.amount.currency}! See more details <a target="_blank" href=https://coinbase.com${url}>here</a>`);
    $('#cb_message').text('').append(message);
    $('#cb_message_container').show();
  } catch (err) {
    clearView();
    let html = $.parseHTML(`Error: ${err.responseJSON.errors[0].message}`);
    $('#cb_message').text('').append(html);
    $('#cb_message_container').show().fadeOut(1500, () => {
      $('#cb_submit_transaction_container').show();
    });
  }
}

const sendTransaction = async (e) => {
  e.preventDefault();
  if (isValidInput()) {
    clearView();
    $('.loader').show();

    setPartialTransactionFunction();

    // Never expecting this first function to return a successful response due to mandated 2 factor authentication
    // for the wallet:transactions:send scope
    try {
      await partialTransactionFunction('');
    } catch (response) {
      clearView();
      if (response.status === 402) {
        $('#cb_submit_2fa_button').bind('click', submit2FACode);
        $('#cb_2fa_verification_container').show();
      } else {
        let html = $.parseHTML(`Error: ${response.responseJSON.errors[0].message}`);
        $('#cb_message').append(html);
        $('#cb_message_container').show()
      }
    }
  } else {
    $('#cb_submit_error_message').text('Please fill in all required fields').show().fadeOut(3000);
  }
}

const clearView = () => {
  $('#cb_signin_container').hide();
  $('#cb_message_container').hide();
  $('#cb_submit_transaction_container').hide();
  $('#cb_2fa_verification_container').hide();
  $('.loader').hide();
}

const onSuccessfulTokenRevocation = () => {
  clearTokens();
  clearView();
  $('#cb_message').text('Revoked!');
  $('#cb_message_container').show().fadeOut(1000, () => {
    $('#cb_signin_container').show();
  });
}

const clearTokens = () => {
  chrome.storage.local.remove(['coinbase_access_token', 'coinbase_refresh_token']);
  coinbase_access_token = undefined;
  coinbase_refresh_token = undefined;
}

const getAccounts = async () => {
  try {
    let response = await ajaxRequest('GET', 'https://api.coinbase.com/v2/accounts');

    let currencies = response.data;

    for (let i = 0; i < currencies.length - 1; i++) {
      let c = currencies[i];
      $('#currencies_dropdown').append(`<option value="${c.id}_${c.balance.currency}">${c.balance.amount} ${c.balance.currency}</option>`);
    }
    clearView();
    showTransactionForm();
  } catch (err) {
    clearView();
    if (err.status === 401 && coinbase_refresh_token) {
      $('#cb_message').text(`Token invalid. Refresh Token?`);
      $('#cb_refresh_token_button').bind('click', sendRefreshTokenMessage).show();
      $('#cb_message_container').show();
    } else {
      clearView();
      $('#cb_signin_container').fadeIn(1000);
    }
  }
}

const showTransactionForm = () => {
  $('#cb_submit_transaction_container').show();
}

const sendSigninMessage = (e) => {
  e.preventDefault();
  chrome.runtime.sendMessage({ directive: 'initiate_oauth' });
}

const sendRefreshTokenMessage = (e) => {
  e.preventDefault();
  clearView();
  $('.loader').show();

  chrome.runtime.sendMessage({ directive: 'refresh_token' }, (response) => {
    if (response.result === 'token_refreshed') {
      coinbase_access_token = response.access_token;
      coinbase_refresh_token = response.refresh_token;
      clearView();
      $('#cb_refresh_token_button').hide();
      $('#cb_message').text('Refreshed!');
      $('#cb_message_container').show().fadeOut(1000, () => {
        getAccounts();
      });
    } else if (response.result === 'error_refreshing_token') {
      clearView();
      $('#cb_message').text(`Error refreshing token. Try signing in again.`);
      clearTokens();
      $('#cb_message_container').show().fadeOut(1500, () => {
        $('#cb_signin_container').show();
      });
    }
  });
}

const sendRevokeTokenMessage = (e) => {
  e.preventDefault();
  clearView();
  $('.loader').show();
  chrome.runtime.sendMessage({ directive: 'revoke_token' }, (response) => {
    if (response.result === 'token_revoked') {
      onSuccessfulTokenRevocation();
    }
  });
}

const calculateExchangeRates = async () => {
  let exchangeRates;
  let amount = parseFloat($('#cb_amount').val());
  let selectedCurrency = $('#currencies_dropdown').children('option:selected').val().split('_')[1];
  if (!selectedCurrency || !amount) {
    return $('#cb_converted_amount').text('');
  }

  let response = await ajaxRequest(
    'GET',
    `https://coinbase.com/api/v2/exchange-rates?currency=${selectedCurrency}`,
  );

  exchangeRates = response.data.rates;
  let convertedAmount = (parseFloat(amount) * parseFloat(exchangeRates['USD'])).toFixed(2);
  $('#cb_converted_amount').text(`${amount} ${selectedCurrency} is about ${convertedAmount} USD`);
}

window.onload = $(() => {
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
