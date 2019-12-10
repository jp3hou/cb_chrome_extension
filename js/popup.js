const HEADER_MESSAGES = [
  "Send a penny for their thoughts!",
  "Show your support!",
  "Send a token of your appreciation!",
  "Thank someone for their work!",
  "Send your compliments to the chef!",
  "Give someone your 2 cents!"
];
const ASSET_ICONS = {
  '0x' : '/images/asset_icons/0x.png',
  'BAT' : '/images/asset_icons/Basic-Attention-Token.png',
  'BTC' : '/images/asset_icons/Bitcoin.png',
  'BCH' : '/images/asset_icons/Bitcoin-Cash.png',
  'LINK' : '/images/asset_icons/Chainlink.png',
  'ETH' : '/images/asset_icons/Ethereum.png',
  'ETC' : '/images/asset_icons/Ethereum-Classic.png',
  'LTC' : '/images/asset_icons/Litecoin.png',
  'XLM' : '/images/asset_icons/Stellar.png',
  'XTZ' : '/images/asset_icons/Tezos.png',
  'USDC' : '/images/asset_icons/USD-Coin.png',
  'XRP' : '/images/asset_icons/XRP.png',
  'ZEC' : '/images/asset_icons/Zcash.png',
};
const CB_VERSION = '2018-10-09';

let coinbase_access_token;
let coinbase_refresh_token;
let partialTransactionFunction;
let selectedTab = 'Send';

const ajaxRequest = (type, url, data = {}, headers = {}) => {
  headers = {
    ...headers,
    'Authorization': `Bearer ${coinbase_access_token}`,
    'CB-VERSION': CB_VERSION,
  };

  return $.ajax({ url, type, data, headers });
};

const showSigninView = () => {
  $('#cb_signin').bind('click', sendSigninMessage);
  clearView();
  $('#cb_signin_container').show();
};

const randomlyGenerateFormMessage = () => {
  let msg = HEADER_MESSAGES[Math.floor(Math.random() * HEADER_MESSAGES.length)];
  $('#cb_submission_form_message').text(msg);
};

const sendTransactionCurried = (account_id, currency, address, amount, description, idem) => {
  return (two_factor_token) => {
    let headers = {};

    if (two_factor_token) {
      headers['CB-2FA-TOKEN'] = two_factor_token;
    }

    return ajaxRequest(
      'POST',
      `https://api.coinbase.com/v2/accounts/${account_id}/transactions`,
      { type: 'send', to: address, amount, description, currency, idem },
      headers,
    );
  }
};

// "freeze" the account id, currency, address, amount, description, and idem values in a partial function that is
// called twice, first without and then with a 2 factor authorization token in the headers
const setPartialTransactionFunction = () => {
  let [account_id, currency] = $('#send_currencies_dropdown').children('option:selected').val().split('_');

  partialTransactionFunction = sendTransactionCurried(
    account_id,
    currency,
    $('#cb_recipient_address').val(),
    $('#cb_amount').val(),
    $('#cb_trx_note').val(),
    `cb_extension_${Date.now()}`,
  );
};

const isValidInput = () => {
  let [account_id, currency] = $('#send_currencies_dropdown').children('option:selected').val().split('_');

  return account_id && currency && $('#cb_recipient_address').val() && $('#cb_amount').val();
};

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
    let html = $.parseHTML(err.responseJSON.errors[0].message);
    $('#cb_message').text('').append(html);
    $('#cb_message_container').show().fadeOut(1500, () => {
      showLoggedInContainer();
    });
  }
};

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
        $('#cb_2fa_code').focus();
      } else {
        let html = $.parseHTML(response.responseJSON.errors[0].message);
        $('#cb_message').append(html);
        $('#cb_message_container').show().fadeOut(2000, () => {
          showLoggedInContainer();
        });
      }
    }
  } else {
    $('#cb_submit_error_message').text('Please fill in all required fields').show().fadeOut(3000);
  }
};

const clearView = () => {
  $('#cb_signin_container').hide();
  $('#cb_message_container').hide();
  $('#cb_logged_in_container').hide();
  $('#cb_2fa_verification_container').hide();
  $('.loader').hide();
};

const onSuccessfulTokenRevocation = () => {
  clearTokens();
  clearView();
  $('#cb_message').text('Logged Out!');
  $('#cb_message_container').show().fadeOut(1000, () => {
    $('#cb_signin_container').show();
  });
};

const clearTokens = () => {
  chrome.storage.local.remove(['coinbase_access_token', 'coinbase_refresh_token']);
  coinbase_access_token = undefined;
  coinbase_refresh_token = undefined;
};

const getAccounts = async () => {
  try {
    let response = await ajaxRequest('GET', 'https://api.coinbase.com/v2/accounts');

    let currencies = response.data;

    for (let i = 0; i < currencies.length - 1; i++) {
      let c = currencies[i];
      $('#send_currencies_dropdown').append(`<option value="${c.id}_${c.balance.currency}">${c.balance.amount} ${c.balance.currency}</option>`);
      $('#receive_currencies_dropdown').append(`<option value="${c.id}">${c.balance.currency}</option>`);
    }
    clearView();
    showLoggedInContainer();
  } catch (err) {
    clearView();
    if (err.status === 401 && coinbase_refresh_token) {
      $('#cb_message').text(`Your access token has expired. Refresh?`);
      $('#cb_refresh_token_button').bind('click', sendRefreshTokenMessage).show();
      $('#cb_message_container').show();
    } else {
      showSigninView();
    }
  }
};

const generateNewAddress = async () => {
  $('#cb_address_info').hide();
  $('#cb_receive_address').text('');
  $('#cb_receive_address_qr_code').text('');
  $('#cb_address_asset_icon').attr("src", '');

  let account_id = $('#receive_currencies_dropdown').children('option:selected').val();
  let currency = $('#receive_currencies_dropdown').children('option:selected').text();
  if (account_id) {
    $('#generate_address_loader').show();
    try {
      let response = await ajaxRequest('POST', `https://api.coinbase.com/v2/accounts/${account_id}/addresses`);
      $('#generate_address_loader').hide();
      if (ASSET_ICONS[currency]) {
        $('#cb_address_asset_icon').attr("src", ASSET_ICONS[currency]).show();
      }

      $('#cb_receive_address').text(response.data.address);
      new QRCode(document.getElementById('cb_receive_address_qr_code'), {
        text: response.data.address,
        width: 150,
        height: 150,
      });
      $('#cb_address_info').show();
    }
    catch {
      $('#generate_address_loader').hide();
      $('#cb_generate_address_error').show().fadeOut(3000);
    }
  } else {
    $('#cb_generate_address_error_message').text('Please select an account').show().fadeOut(3000);
  }
};

const showLoggedInContainer = () => {
  $('#cb_logged_in_container').show();
  if (selectedTab === 'Send') {
    $('#cb_receive_container').hide();
    $('#cb_options_container').hide();
    $('#cb_receive_tab').removeClass('active_tab').addClass('inactive_tab');
    $('#cb_options_tab').removeClass('active_tab').addClass('inactive_tab');
    $('#cb_send_tab').removeClass('inactive_tab').addClass('active_tab');
    $('#cb_send_container').show();
  } else if (selectedTab === 'Receive') {
    $('#cb_send_container').hide();
    $('#cb_options_container').hide();
    $('#cb_send_tab').removeClass('active_tab').addClass('inactive_tab');
    $('#cb_options_tab').removeClass('active_tab').addClass('inactive_tab');
    $('#cb_receive_tab').removeClass('inactive_tab').addClass('active_tab');
    $('#cb_receive_container').show();
  } else if (selectedTab === 'Options') {
    $('#cb_send_container').hide();
    $('#cb_receive_container').hide();
    $('#cb_send_tab').removeClass('active_tab').addClass('inactive_tab');
    $('#cb_receive_tab').removeClass('active_tab').addClass('inactive_tab');
    $('#cb_options_tab').removeClass('inactive_tab').addClass('active_tab');
    $('#cb_options_container').show();
  }
};

const switchTabs = (tab) => {
  selectedTab = tab;
  showLoggedInContainer();
};

const sendSigninMessage = (e) => {
  e.preventDefault();
  chrome.runtime.sendMessage({ directive: 'initiate_oauth' });
};

const sendRefreshTokenMessage = (e) => {
  e.preventDefault();
  clearView();
  $('#cb_loader').show();

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
};

const sendRevokeTokenMessage = (e) => {
  e.preventDefault();
  clearView();
  $('#cb_loader').show();
  chrome.runtime.sendMessage({ directive: 'revoke_token' }, (response) => {
    if (response.result === 'token_revoked') {
      onSuccessfulTokenRevocation();
    }
  });
};

const calculateExchangeRates = async () => {
  let exchangeRates;
  let amount = parseFloat($('#cb_amount').val());
  let selectedCurrency = $('#send_currencies_dropdown').children('option:selected').val().split('_')[1];
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
};

const initialize = () => {
  randomlyGenerateFormMessage();
  $('#cb_revoke_token_access_button').bind('click', sendRevokeTokenMessage);
  $('#cb_submit_transaction_button').bind('click', sendTransaction);
  $('#cb_generate_new_address_button').bind('click', generateNewAddress);
  $('#cb_amount').keyup(calculateExchangeRates);
  $('#send_currencies_dropdown').change(calculateExchangeRates);
  $('#cb_send_tab').bind('click', () => { switchTabs('Send') });
  $('#cb_receive_tab').bind('click', () => { switchTabs('Receive') });
  $('#cb_options_tab').bind('click', () => { switchTabs('Options') });
  $('#cb_loader').show();
  getAccounts();
};

window.onload = $(() => {
  chrome.storage.local.get(['coinbase_access_token', 'coinbase_refresh_token'], (result) => {
    if (result.coinbase_access_token === undefined) {
      showSigninView();
    } else {
      coinbase_access_token = result.coinbase_access_token;
      coinbase_refresh_token = result.coinbase_refresh_token;
      initialize();
    }
  });
});
