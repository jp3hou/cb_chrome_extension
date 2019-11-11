// function interactiveSignIn() {
//   console.log("Installed");
//
//   chrome.identity.launchWebAuthFlow(
//     {
//       'url': 'https://www.coinbase.com/oauth/authorize?client_id=d3a57b32056172fc74b8e46436ac08e3082aef663aaaf4f3ab6b396f882dcef7&redirect_uri=https%3A%2F%2Faliafefgjbgnlfcjhdklhieafeheaoaj.chromiumapp.org%2Fredirect_uri&response_type=code&scopes=wallet%3Auser%3Aread,wallet%3Auser%3Aupdate',
//       'interactive': true
//     },
//     function (redirect_url) {
//       alert(redirect_url);
//       chrome.storage.local.set({url: redirect_url}, function() {
//         console.log(chrome.storage.local);
//       });
//     });
// }
//
// chrome.runtime.onInstalled.addListener(function() {
//   console.log("Installed");
//
//   let signin_button = document.querySelector('#signin');
//   signin_button.onclick = interactiveSignIn;
// });
//
// $(function() {
//   $('#cb_name').keyup(function() {
//     console.log('something is happening!!');
//     $('#greet').text('Hello ' + $('#cb_name').val());
//   })
// });
