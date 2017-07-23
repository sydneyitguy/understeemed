window.Account = (function() {
  var KEY_USERNAME = 'USERNAME';
  var username = localStorage.getItem(KEY_USERNAME) || 'tabris';

  var setAccount = function(newName) {
    username = newName;
    localStorage.setItem(KEY_USERNAME, username, 3650);

    steem.api.getAccounts([username], function(error, res){
      if (error) {
        $('.errors').fadeIn();
        console.log(error);
      } else {
        $('.errors').fadeOut();
        var account = res[0];
        // console.log(account);

        account.voting_power = account.voting_power / 100;
        var template = Handlebars.compile($('#account-template').html());
        $('#account-container').html(template(account));
      }
    });
  };

  return {
    bind: function() {
      // Username changed
      $('#account-container').on('click', '#change-user', function() {
        var newName = prompt("Please enter your Steemit username", username);
        if (newName != null) {
            setAccount(newName);
        }
      });

      setInterval(function(){
        setAccount(username);
      }, 60000); // refresh every minute
      setAccount(username);
    }
  }
})();