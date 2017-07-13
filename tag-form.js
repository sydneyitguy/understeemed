window.TagForm = (function() {
  var $tagsContainer = $('#tags-container');
  var $tagInput = $('#tag-input');
  var tagTemplate = Handlebars.compile($('#tag-template').html());

  var refreshTags = function() {
    var html = '';
    var tags = TagStorage.getAll();
    for(var i in tags) {
      html += tagTemplate({ tag: tags[i] });
    }
    $tagsContainer.html(html);
    $tagsContainer.prepend('<div class="tag-button all" data-tag=""><a class="tag-link" href="#">all</a></div>')
  };

  var fetchCurrentTag = function() {
    var tag = window.location.hash.substr(1);
    FeedFilter.fetch(tag);
    TagForm.highlight(tag);
  }

  return {
    bind: function() {
      refreshTags();
      $('#tag-form').submit(function() {
        var tag = $tagInput.val().toLowerCase().replace(/[^a-z-]/g, '');
        if (tag) {
          TagStorage.add(tag);
          refreshTags();
        }
        $tagInput.val('');

        return false;
      });

      $('#tags-container').on('click', '.remove', function() {
        TagStorage.remove($(this).data('tag'));
        refreshTags();
      });

      $(window).bind( 'hashchange', function(e) {
        fetchCurrentTag();
      });

      $('.option-select').change(function() {
        fetchCurrentTag();
      })
    },

    checkCurrentAnchor: function() {
      var tag = window.location.hash.substr(1);
      FeedFilter.fetch(tag);
      TagForm.highlight(tag);
    },

    highlight: function(tag) {
      $('.tag-button').removeClass('active');
      $('.tag-button[data-tag="' + tag + '"]').addClass('active');
    }
  }
})();