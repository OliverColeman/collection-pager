
if (Meteor.isServer) {
  CollectionPagers = {};
  CollectionPagers.publish = function (self, id, collection, querySelector, queryOptions, options) {
    for (qo of ['limit', 'skip', 'sort'])
      if (!queryOptions.hasOwnProperty(qo))
        throw new Error(`collection-pager: ${qo} must be specified in the query options for ${id}.`);

    options = options || {};
    let initializing = true;
    const totalCursor = collection.find(querySelector);
    const pageCursor = collection.find(querySelector, queryOptions);
    let pagerDoc = {
      totalCount: totalCursor.count(),
      skip: queryOptions.skip,
      limit: queryOptions.limit,
      currentIds: [],
    };
    let totalHandle, pageHandle;

    const updatePagerDocTotal = (amount) => {
      pagerDoc.totalCount += amount;
      return pagerDoc;
    }
    const updatePagerDocDocs = () => {
      pagerDoc.currentIds = pageCursor.map(doc => doc._id);
      return pagerDoc;
    }

    const totalCursorObservers = {
      added: function (doc) {
        if (!initializing) {
          self.changed('collectionpagers', id, updatePagerDocTotal(1));
        }
      },
      removed: function (doc) {
        self.changed('collectionpagers', id, updatePagerDocTotal(-1));
      },
    };

    const pageCursorObservers = {
      added: function (doc) {
        if (!initializing) {
          self.changed('collectionpagers', id, updatePagerDocDocs());
        }
      },
      removed: function (doc) {
        self.changed('collectionpagers', id, updatePagerDocDocs());
      },
      changed: function (doc) {
        self.changed('collectionpagers', id, updatePagerDocDocs());
      },
    };

    self.added('collectionpagers', id, updatePagerDocDocs());

    if (!options.nonReactive) {
      pageHandle = pageCursor.observe(pageCursorObservers);
      totalHandle = totalCursor.observe(totalCursorObservers);
    }

    initializing = false;

    self.onStop(function () {
      totalHandle.stop();
      pageHandle.stop();
    });

    return {
      stop: function () {
        if (totalHandle) {
          totalHandle.stop();
          totalHandle = undefined;
          pageHandle.stop();
          pageHandle = undefined;
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
