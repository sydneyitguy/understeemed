window.FeedFilter = (function() {
  var $feedCount = $('#feed-count');
  var $feedContainer = $('#feed-container');
  var feedTemplate = Handlebars.compile($('#feed-template').html());
  var page = 1;

  var optionCreated = 30;
  var $optionCreated = $('#option-created');
  var optionVotes = 0;
  var $optionVotes = $('#option-votes');
  var optionValue = 5;
  var $optionValue = $('#option-value');
  var optionLength = 500;
  var $optionLength = $('#option-length');

  var isUnderValued = function(discussion) {
    var pendingPayoutValue = parseFloat(discussion.pending_payout_value);
    var diffTimeInMinutes = ((new Date()).getTime() - (new Date(discussion.created)).getTime()) / 60000;

    return diffTimeInMinutes >= optionCreated &&
      discussion.net_votes >= optionVotes &&
      pendingPayoutValue <= optionValue &&
      discussion.body.length >= optionLength;
  };

  var fetchNext = function(tag, lastPermlink, lastAuthor) {
    steem.api.getDiscussionsByCreated({ 'tag': tag, 'limit': 20, "start_permlink": lastPermlink, "start_author": lastAuthor }, function(err, result) {
      if (err === null) {
        $errors.fadeOut();

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
          $errors.fadeIn();
      }
    });
  };

  return {
    fetch: function(tag) {
      page = 1;
      optionCreated = parseInt($optionCreated.val());
      optionValue = parseInt($optionValue.val());
      optionLength = parseInt($optionLength.val());
      optionVotes = parseInt($optionVotes.val());

      $feedContainer.empty();
      $feedCount.text('Fetching...');
      fetchNext(tag);
    }
  };
})();