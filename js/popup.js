const HEADER_MESSAGES = [
  "Send a penny for their thoughts!",
  "Show your support!",
  "Send a token of your appreciation!",
  "Thank someone for their work!",
  "Send your compliments to the chef!",
  "Give someone your 2 cents!"
];

let coinbase_access_token;

chrome.storage.local.get('coinbase_access_token', function (result) {
  if (!chrome.runtime.lastError) {
    coinbase_access_token = result.coinbase_access_token;
  }
});

function onSuccessfulTokenRevocation() {
  chrome.storage.local.remove(['coinbase_access_token', 'coinbase_refresh_token']);
  coinbase_access_token = undefined;
  $('.loader').hide();
  $('#cb_submit_transaction_container').hide();
  $('#cb_message').text('Revoked!');
  $('#cb_message_container').show().fadeOut(1000, function () {
    $('#cb_signin_container').show();
  });
}

function revokeToken(e) {
  e.preventDefault();
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
      $('#cb_submit_transaction_container').hide();
      $('#cb_message').text('Sent!');
      $('#cb_message_container').show().fadeOut(1000);
    },
    error: function (error) {
      $('#cb_submit_transaction_form').hide();
      $('#cb_message').text(`Something went wrong: ${error.message}`);
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

      $('.loader').hide();
      showTransactionForm();
    },
    error: function (error) {
      $('#cb_submit_transaction_form').hide();
      $('#cb_message').text(`Something went wrong: ${error.message}`);
    }
  });
}

function showTransactionForm() {
  $('#cb_signin_container').hide();
  $('#cb_submit_transaction_container').show();
}

function sendSigninMessage(e) {
  e.preventDefault();
  chrome.runtime.sendMessage({directive: "initiate_oauth"});
}

window.onload = $(function () {
  randomlyGenerateFormMessage();
  $('#cb_signin').bind("click", sendSigninMessage);
  $('#cb_submit_transaction_button').bind("click", sendTransaction);
  $('#cb_revoke_token_access_button').bind("click", revokeToken);

  if (coinbase_access_token !== undefined) {
    $('.loader').show();
    getAccounts();
  } else {
    showSigninView();
  }
});
