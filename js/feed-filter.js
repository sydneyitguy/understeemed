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
  var $optionReputation = $('#option-reputation');
  var $optionImages = $('#option-images');
  var options = {
    created: 30, // minimum minutes since created
    votes: 0, // minimum votes received
    value: 5, // maximum SBD received
    reputation: 0, // minimum author reputation score
    images: 1, // minimum number of images
    length: 500 // minimum content length
  };

  var permlinks = {}; // To remove duplicates

  var isUnderValued = function(discussion) {
    var pendingPayoutValue = parseFloat(discussion.pending_payout_value);
    var diffTimeInMinutes = ((new Date()).getTime() - (new Date(discussion.created)).getTime()) / 60000;

    return diffTimeInMinutes >= options['created'] &&
      discussion.author_rep_score >= options['reputation'] &&
      discussion.net_votes >= options['votes'] &&
      (discussion.images||[]).length >= options['images'] &&
      pendingPayoutValue <= options['value'] &&
      discussion.body.length >= options['length'];
  };

  var fetchNext = function(tag, permlink, author) {
    steem.api.getDiscussionsByCreated({ 'tag': tag, 'limit': 20, "start_permlink": permlink, "start_author": author }, function(err, result) {
      if (err === null) {
        $('.errors').fadeOut();

        // console.log(result);

        var len = result.length;
        var lastPermlink = null;
        var lastAuthor = null;

        for (i = 0; i < len; i++) {
          var discussion = result[i];
          // console.log(i, discussion);

          if (i == len - 1) {
            lastPermlink = discussion.permlink;
            lastAuthor = discussion.author;
          }

          if (permlinks[discussion.id]) {
            // console.log('already exists');
            continue;
          } else {
            permlinks[discussion.id] = 1;
          }

          discussion.created = discussion.created + '+00:00';
          discussion.author_rep_score = Math.floor((Math.log10(discussion.author_reputation)-9)*9+25);
          discussion.images = JSON.parse(discussion.json_metadata).image;
          if (isUnderValued(discussion)) {
            discussion.created = moment(discussion.created).fromNow();
            if (discussion.images) {
              discussion.image_url = discussion.images[0];
            }
            discussion.body = removeMd(discussion.body);
            $feedContainer.append(feedTemplate(discussion));
          }
        }

        var totalCount = $feedContainer.find('.feed').length;
        $feedCount.html('Fetched page ' + page + ' <span class="spacer">&middot;</span> ' + totalCount + ' articles in total <span class="spacer">&middot;</span> ' +
          '<a href="https://steemit.com/trending/' + tag + '" target="_blank">trending</a>');

        if (len < 20) {
          console.log('Results size is less than the limit -> Last page?');
        } else if (totalCount < 20 && page < 100) {
          page++;
          // console.log(tag, lastPermlink, lastAuthor);
          fetchNext(tag, lastPermlink, lastAuthor);
        } else {
          if (totalCount >= 20) {
            console.log("Finished fetching 20 results, stop.");
          } else {
            console.log("Couldn't find enough matching posts till page 100.");
          }
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
      permlinks = [];
      $feedContainer.empty();
      $feedCount.text('Fetching...');

      fetchNext(tag);
    },

    bind: function() {
      // Load saved options
      var savedOptions = localStorage.getItem(KEY_OPTIONS);
      if (savedOptions) {
        options = JSON.parse(savedOptions);
        options['reputation'] = options['reputation'] || 0;
        options['images'] = options['images'] || 0;
      }
      $optionCreated.val(options['created']);
      $optionVotes.val(options['votes']);
      $optionValue.val(options['value']);
      $optionLength.val(options['length']);
      $optionReputation.val(options['reputation']);
      $optionImages.val(options['images']);

      // Options changed
      $('.option-select').change(function() {
        options = {
          reputation: parseInt($optionReputation.val()),
          created: parseInt($optionCreated.val()),
          votes: parseInt($optionVotes.val()),
          value: parseInt($optionValue.val()),
          images: parseInt($optionImages.val()),
          length: parseInt($optionLength.val())
        };
        localStorage.setItem(KEY_OPTIONS, JSON.stringify(options), 3650);

        TagForm.fetchCurrentTag();
      });
    }
  };
})();