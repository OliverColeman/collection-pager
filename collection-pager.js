
if (Meteor.isServer) {
  CollectionPagers = {};
  CollectionPagers.publish = function (self, id, collection, querySelector, queryOptions, options) {
    for (qo of ['limit', 'skip', 'sort'])
      if (!queryOptions.hasOwnProperty(qo))
        throw new Error(`collection-pager: ${qo} must be specified in the query options for ${id}.`);

    options = options || {};
    let initializing = true;
    let handle;
    let totalCount = 0;
    const pageCursor = collection.find(querySelector, queryOptions);
    const totalCursor = collection.find(querySelector);

    if (options.fastCount ) {
      if (totalCursor._cursorDescription.options.limit)
        throw new Error("collection-pager: there is no reason to use fastCount with a limit on the total count. fastCount is to enable large data sets to have fast but potentially inaccurate cursors.");

      totalCount = totalCursor.count();
      totalCursor._cursorDescription.options.skip = totalCount;
    }

    const makePagerDoc = (totalCount) => {
      return {
        totalCount,
        skip: queryOptions.skip,
        limit: queryOptions.limit,
        currentIds: pageCursor.map(doc => doc._id),
      };
    }

    const observers = {
      added: function (doc) {
        totalCount += 1;
        if (!initializing) {
          self.changed('collectionpagers', id, makePagerDoc(totalCount));
        }
      },
      removed: function (doc) {
        totalCount -= 1;
        self.changed('collectionpagers', id, makePagerDoc(totalCount));
      }
    };

    self.added('collectionpagers', id, makePagerDoc(totalCursor.count()));

    if (!options.nonReactive) {
      // Only observe totalCursor, the list of published docs according to pageCursor will also be updated.
      handle = totalCursor.observe(observers);
    }

    initializing = false;

    self.onStop(function () {
      if (handle)
        handle.stop();
    });

    return {
      stop: function () {
        if (handle) {
          handle.stop();
          handle = undefined;
        }
      },

      pageCursor
    };
  };
}


if (Meteor.isClient) {
  CollectionPagers = new Mongo.Collection('collectionpagers');
  CollectionPagers.getTotalCount = function(id) {
    const cp = this.findOne(id);
    return cp && cp.totalCount || 0;
  }
  CollectionPagers.getDocuments = function(id, collection) {
    const cp = this.findOne(id);
    if (!cp || !cp.currentIds.length) return [];
    return cp.currentIds.map(id => collection.findOne(id)).filter(d => !!d);
  }
  CollectionPagers.get = function(id) {
    const cp = this.findOne(id);
    return cp || {
      totalCount: 0,
      currentIds: []
    };
  };
}
