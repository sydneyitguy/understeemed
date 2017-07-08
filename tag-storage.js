window.TagStorage = (function() {
  var KEY = 'TAG';
  var tags = [];

  var save = function() {
    localStorage.setItem(KEY, tags.join(','), 3650);
    return tags;
  }

  return {
    init: function() {
      var saved = localStorage.getItem(KEY);
      if (saved) {
        tags = saved.split(',');
      }
    },
    getAll: function() {
      return tags;
    },
    add: function(tag) {
      if (tags.indexOf(tag) == -1) {
        tags.push(tag);

        return save();
      } else {
        console.log('Already exists');

        return null;
      }
    },
    remove: function(tag) {
      var i = tags.indexOf(tag);
      if(i == -1) {
        console.log('No ' + tag + ' found in the storage');

        return null;
      }
      tags.splice(i, 1); // ignore IE8

      return save();
    },
    reset: function() {
      tags = [];
      localStorage.removeItem(KEY);

      return tags;
    }
  };
})();
TagStorage.init();
