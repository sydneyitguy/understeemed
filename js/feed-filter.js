window.FeedFilter = (function() {
  var KEY_OPTIONS = 'OPTIONS';

  var $feedCount = $('#feed-count');
  var $feedContainer = $('#feed-container');
  var feedTemplate = Handlebars.compile($('#feed-template').html());
  var page = 1;

  var $optionCreated = $('#option-created');
  var $optionVotes = $('#option-votes');
  var $optionValue = $('#option-value');
  var $optionLength = $('#option-length');
  var options = {
    created: 30, // minimum minutes since created
    votes: 0, // minimum votes received
    value: 5, // maximum SBD received
    length: 500 // minimum content length
  }

  var isUnderValued = function(discussion) {
    var pendingPayoutValue = parseFloat(discussion.pending_payout_value);
    var diffTimeInMinutes = ((new Date()).getTime() - (new Date(discussion.created)).getTime()) / 60000;

    return diffTimeInMinutes >= options['created'] &&
      discussion.net_votes >= options['votes'] &&
      pendingPayoutValue <= options['value'] &&
      discussion.body.length >= options['length'];
  };

  var fetchNext = function(tag, lastPermlink, lastAuthor) {
    steem.api.getDiscussionsByCreated({ 'tag': tag, 'limit': 20, "start_permlink": lastPermlink, "start_author": lastAuthor }, function(err, result) {
      if (err === null) {
        $('.errors').fadeOut();

        var len = result.length;
        if (len === 0) {
          console.log('End of result, finish');
          return;
        }
        for (i = 0; i < len; i++) {
          var discussion = result[i];
          // console.log(i, discussion);

          discussion.created = discussion.created + '+00:00';
          if (isUnderValued(discussion)) {
            discussion.created = moment(discussion.created).fromNow();
            var images = JSON.parse(discussion.json_metadata).image
            if (images) {
              discussion.image_url = images[0];
            }
            discussion.body = removeMd(discussion.body);
            $feedContainer.append(feedTemplate(discussion));
          }

          if (i == len - 1) {
            lastPermlink = discussion.permlink;
            lastAuthor = discussion.author;
          }
        }

        var totalCount = $feedContainer.find('.feed').length;
        $feedCount.html('Fetched page ' + page + ' <span class="spacer">&middot;</span> ' + totalCount + ' articles in total <span class="spacer">&middot;</span> ' +
          '<a href="https://steemit.com/trending/' + tag + '" target="_blank">trending</a>');
        if (totalCount < 20 && page < 100) {
          page++;
          fetchNext(tag, lastPermlink, lastAuthor)
        }
      } else {
          console.log(err);
          $('.errors').fadeIn();
      }
    });
  };

  return {
    fetch: function(tag) {
      page = 1;
      $feedContainer.empty();
      $feedCount.text('Fetching...');

      fetchNext(tag);
    },

    bind: function() {
      // Load saved options
      var savedOptions = localStorage.getItem(KEY_OPTIONS);
      if (savedOptions) {
        options = JSON.parse(savedOptions);
      }
      console.log(options);
      $optionCreated.val(options['created']);
      $optionVotes.val(options['votes']);
      $optionValue.val(options['value']);
      $optionLength.val(options['length']);

      // Options changed
      $('.option-select').change(function() {
        console.log('changed');
        options = {
          created: parseInt($optionCreated.val()),
          votes: parseInt($optionVotes.val()),
          value: parseInt($optionValue.val()),
          length: parseInt($optionLength.val())
        };
        localStorage.setItem(KEY_OPTIONS, JSON.stringify(options), 3650);

        TagForm.fetchCurrentTag();
      });
    }
  };
})();