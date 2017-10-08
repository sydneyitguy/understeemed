window.FeedFilter = (function() {
  var KEY_OPTIONS = 'OPTIONS';
  var MAX_LENGTH = 40;

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

    // Check everything that does not require to parse metadata
    var valid_so_far = diffTimeInMinutes >= options['created'] &&
      discussion.author_rep_score >= options['reputation'] &&
      discussion.net_votes >= options['votes'] &&
      pendingPayoutValue <= options['value'] &&
      discussion.body.length >= options['length'];

    if (!valid_so_far) {
      return false;
    }

    // Check metadata-related filters
    parseMetadata(discussion);
    return discussion.images.length >= options['images'];
  };

  var fetchNext = function(tag, permlink, author) {
    var PER_PAGE = 20;

    steem.api.getDiscussionsByCreated({ 'tag': tag, 'limit': PER_PAGE, "start_permlink": permlink, "start_author": author }, function(err, result) {
      if (err === null) {
        $('.errors').fadeOut();

        // console.log(result);

        var len = result.length;
        var lastPermlink = null;
        var lastAuthor = null;
        var postsByAuthor = {};

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
          discussion.author_rep_score = Math.floor((Math.log10(discussion.author_reputation) - 9) * 9 + 25);
          if (isUnderValued(discussion)) {
            parseMetadata(discussion);
            discussion.created = moment(discussion.created).fromNow();
            discussion.body = removeMd(discussion.body);
            var $post = $(feedTemplate(discussion));
            $feedContainer.append($post);
            $post.data('duscussion', discussion);
            postsByAuthor[discussion.author] = postsByAuthor[discussion.author] || [];
            postsByAuthor[discussion.author].push($post);
          }
        }

        var totalCount = $feedContainer.find('.feed').length;
        $feedCount.html('Fetched page ' + page + ' <span class="spacer">&middot;</span> ' + totalCount + ' articles in total <span class="spacer">&middot;</span> ' +
          '<a href="https://steemit.com/trending/' + tag + '" target="_blank">trending</a>');

        if (len < PER_PAGE) {
          console.log('Results size is less than the limit -> Last page?');
        } else if (totalCount < MAX_LENGTH && page < 100) {
          page++;
          // console.log(tag, lastPermlink, lastAuthor);
          fetchNext(tag, lastPermlink, lastAuthor);
        } else {
          if (totalCount >= MAX_LENGTH) {
            console.log('Finished fetching ' + totalCount + ' results, stop.');
          } else {
            console.log("Couldn't find enough matching posts till page 100.");
          }
        }

        // Fetch average post payout for each user
        // and update DOM once data is ready
        updateMedianPayout(postsByAuthor);

      } else {
          console.log(err);
          $('.errors').fadeIn();
      }
    });
  };

  /**
   * Fetch last 10 posts for each author, calculate average payout and update DOM
   * @param postsByAuthor object { author_name: Array of jQuery elements that represent posts }
   */
  var updateMedianPayout = (function() { "use strict";

    var cache = {};

    return updateAll;

    function updateAll(postsByAuthor) {
      var authors = Object.keys(postsByAuthor);
      if (!authors.length) {
        return;
      }

      var updatedCount = 0;
      authors.forEach(function(author) {

        // Don't ever fetch same author twice. Update DOM right away.
        if (cache[author] !== undefined) {
          updatePosts(postsByAuthor[author], cache[author]);
          return;
        }

        // Fetch last 10 posts of an author from API
        var beforeDate = new Date().toISOString().slice(0, 19); // 2017-01-01T00:00:00
        steem.api.getDiscussionsByAuthorBeforeDate(author, '', beforeDate, 11, function(err, posts) {
          if (err) {
            cache[author] = '?';
            console.log('Unable to fetch average payout for '+author, err);
            updatePosts(postsByAuthor[author], cache[author]);
            return;
          }
          if (posts.length <= 0) {
            cache[author] = '?';
            console.log('This can not happen: author has no posts '+author);
            updatePosts(postsByAuthor[author], cache[author]);
            return;
          }

          // Calculate total and average payout for last 11 posts
          posts = posts.slice(0, 11);
          var sortedPosts = {};
          for (var i in posts) {
            var reward = parseFloat((posts[i].total_payout_value || '0').split(' ')[0]) + parseFloat((posts[i].pending_payout_value || '0').split(' ')[0]);
            if (sortedPosts[reward]) {
              sortedPosts[reward + Math.random() * 0.000000001] = posts[i]; // To prevent removing duplicates
            } else {
              sortedPosts[reward] = posts[i];
            }
          }
          sortedPosts = sortObjectByKey(sortedPosts);
          var keys = Object.keys(sortedPosts);
          var medianPayout = keys[Math.floor(keys.length / 2)];
          medianPayout = (Math.round(medianPayout * 1000) / 1000); // 3rd digits below zero
          // console.log(medianPayout, keys, posts, sortedPosts);

          // Write to cache
          var currency = posts[0].total_payout_value.split(' ')[1] || '';
          cache[author] = "$" + medianPayout + ' ' + currency + ' (' + posts.length + ' posts)';

          // Update DOM
          updatePosts(postsByAuthor[author], cache[author]);
        });
      });
    }

    /**
     * Sort object by numeric value of key (ascending)
     */
    function sortObjectByKey(obj) {
      return Object.keys(obj).sort(function(a, b) {
        return a - b;
      }).reduce(function (result, key) {
        result[key] = obj[key];
        return result;
      }, {});
    };

    function updatePosts(posts, avg_payout) {
      posts.forEach(function($post) {
        $post.find('.author-average-payout').show().find('.amount').text(avg_payout);
      });
    }
  }());

  // parse discussion.json_metadata into discussion.metadata and related fields
  // (unless already done) then return discussion.
  var parseMetadata = function(discussion) {
    if (discussion.metadata === undefined) {
      discussion.metadata = {};
      discussion.images = [];
      discussion.image_url = null;
      discussion.tags = [];
      discussion.tags_string = '';

      try {
          discussion.metadata = JSON.parse(discussion.json_metadata) || {};
          discussion.images = discussion.metadata.image || [];
          discussion.image_url = discussion.images[0] || null;
          discussion.tags = discussion.metadata.tags || [];
          discussion.tags_string = discussion.tags.join(', ');
      } catch (e) {
      }
    }
    return discussion;
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