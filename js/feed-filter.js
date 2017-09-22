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
        var posts_by_author = {};

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
          discussion.metadata = JSON.parse(discussion.json_metadata);
          discussion.images = discussion.metadata.image;
          if (isUnderValued(discussion)) {
            discussion.created = moment(discussion.created).fromNow();
            if (discussion.images) {
              discussion.image_url = discussion.images[0];
            }
            discussion.body = removeMd(discussion.body);
            discussion.tags_string = (discussion.metadata.tags||[]).join(', ');
            var $post = $(feedTemplate(discussion));
            $feedContainer.append($post);
            $post.data('duscussion', discussion);
            posts_by_author[discussion.author] = posts_by_author[discussion.author] || [];
            posts_by_author[discussion.author].push($post);
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

        // Fetch average post payout for each user
        // and update DOM once data is ready
        updateAveragePayout(posts_by_author);

      } else {
          console.log(err);
          $('.errors').fadeIn();
      }
    });
  };

  /**
   * updateAveragePayout()
   * Fetch last 10 posts for each author, calculate average payout and update DOM
   * @param posts_by_author object { author_name: Array of jQuery elements that represent posts }
   */
  var updateAveragePayout = (function() { "use strict";

    var cache = {};
    var currency = null;

    return updateAll;

    function updateAll(posts_by_author) {
      var authors = Object.keys(posts_by_author);
      if (!authors.length) {
        return;
      }

      authors.forEach(function(author) {

        // Don't ever fetch same author twice. Update DOM right away.
        if (cache[author] !== undefined) {
          updatePosts(posts_by_author[author], cache[author], currency);
          return;
        }

        // Fetch last 10 posts of an author from API
        var beforeDate = new Date().toISOString().slice(0, 19); // 2017-01-01T00:00:00
        steem.api.getDiscussionsByAuthorBeforeDate(author, '', beforeDate, 10, function(err, posts) {
          if (err) {
            cache[author] = 0;
            console.log('Unable to fetch average payout for '+author, err);
            return;
          }
          if (posts.length <= 0) {
            cache[author] = 0;
            console.log('This can not happen: author has no posts '+author);
            return;
          }

          // Calculate total and average payout
          var total_payout = posts.reduce(function(total, post) {
            return total + parseFloat((post.total_payout_value||'0').split(' ')[0]);
          }, 0);
          var avg_payout = total_payout / posts.length;
          cache[author] = avg_payout;

          // Update DOM
          currency = posts[0].total_payout_value.split(' ')[1]||'';
          updatePosts(posts_by_author[author], avg_payout, currency);
        });
      });
    }

    function updatePosts(posts, avg_payout, currency) {
      posts.forEach(function($post) {
        $post.find('.author-average-payout').show().find('.amount').text(
          "$" + (Math.round(avg_payout*1000)/1000) + ' ' + currency
        );
      });
    }
  }());

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