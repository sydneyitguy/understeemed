window.FeedFilter = (function() {
  var KEY_OPTIONS = 'OPTIONS';
  var PER_PAGE = 100;
  var MAX_PAGE = 100;
  var MAX_STACK_SIZE = 100;
  var MAX_TIME = 2880; // 2 days old max

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

  var permlinks = {}; // To remove duplicates
  var discussions = {}; // To sort by scores

  var isUnderValued = function(discussion) {
    var pendingPayoutValue = parseFloat(discussion.pending_payout_value);
    var diffTimeInMinutes = ((new Date()).getTime() - (new Date(discussion.created)).getTime()) / 60000;

    return diffTimeInMinutes >= options['created'] &&
      discussion.net_rshares > 0 && // filter down-voted
      discussion.image_url && // filter with images
      discussion.net_votes >= options['votes'] &&
      pendingPayoutValue <= options['value'] &&
      discussion.body_trimed.length >= options['length'];
  };

  var getScore = function(discussion) {
    var pendingPayoutValue = parseFloat(discussion.net_rshares);
    if (pendingPayoutValue == 0) {
      console.log(discussion);
    }
    return pendingPayoutValue / discussion.net_votes;
  };

  var sortObject = function(obj) {
    return Object.keys(obj).sort().reduce(function (result, key) {
      result[key] = obj[key];
      return result;
    }, {});
  };

  var fetchNext = function(tag, permlink, author) {
    steem.api.getDiscussionsByCreated({ 'tag': tag, 'limit': PER_PAGE, "start_permlink": permlink, "start_author": author }, function(err, result) {
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
          discussion.body_trimed = removeMd(discussion.body);
          var images = JSON.parse(discussion.json_metadata).image
          if (images) {
            discussion.image_url = images[0];
          }

          if (isUnderValued(discussion)) {
            discussion.created = moment(discussion.created).format('MMM D, hh:mma');
            discussion.body_trimed = discussion.body_trimed.substring(0, 200);
            discussions[getScore(discussion)] = discussion;
          }

          var diffTimeInMinutes = ((new Date()).getTime() - (new Date(discussion.created)).getTime()) / 60000;
          if (diffTimeInMinutes > MAX_TIME) {
            console.log('Fetched till the maximum age, Stop.');
            return render();
          }
        }

        var totalCount = Object.keys(discussions).length;
        $feedCount.html('Fetched page ' + page + ' <span class="spacer">&middot;</span> ' + totalCount + ' articles in total <span class="spacer">&middot;</span> ' +
          '<a href="https://steemit.com/trending/' + tag + '" target="_blank">trending</a>');

        if (len < PER_PAGE) {
          console.log('Results size is less than the limit -> Last page?');
          return render();
        } else if (totalCount > MAX_STACK_SIZE) {
          console.log('Fetched maximum articles: ' + totalCount + ', Stop.');
          return render();
        } else if (page >= MAX_PAGE) {
          console.log('Fetched maximum pages: ' + page + ', Stop.');
          return render();
        } else {
          page++;
          // console.log(tag, lastPermlink, lastAuthor);
          return fetchNext(tag, lastPermlink, lastAuthor);
        }
      } else {
          console.log(err);
          $('.errors').fadeIn();
      }
    });
  };

  var render = function() {
    var sorted = sortObject(discussions);
    for (i in sorted) {
      $feedContainer.append(feedTemplate(discussions[i]));
    }
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
      }
      $optionCreated.val(options['created']);
      $optionVotes.val(options['votes']);
      $optionValue.val(options['value']);
      $optionLength.val(options['length']);

      // Options changed
      $('.option-select').change(function() {
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