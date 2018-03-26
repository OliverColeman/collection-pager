# Collection Pager

A Meteor package making it easy to create reactive, performant pagers.

Collection Pager is agnostic to your front-end. It provides the plumbing to create pagers but not the UI elements.

## Installation

``` sh
$ meteor add ojc:collection-pager
```

## API

### Server side
Within a publication function call `CollectionPagers.publish(this, <pagerId>, <collection>, <querySelector>, <queryOptions>, [<options>])`,
and return the pageCursor property of the returned object. For example:
```js
Docs = new Meteor.Collection('docs');
...
Meteor.publish('docsWithColour', function(pagerId, colour, skip, limit) {
  const querySelector = { colour: colour };
  const queryOptions = {
    skip: skip,
    limit: limit,
    sort: ['name', '_id']
  }
  const handle = CollectionPagers.publish(this, pagerId, Docs, querySelector, queryOptions);
  return handle.pageCursor;
});
```

In this example:
- `pagerId` is a unique id for the pager publication/subscription. It will be used in the client-side code.
- `colour` is just a field we're filtering on for the sake of example.
- `skip` is the number of documents to skip, typically this will be calculated as `pageNumber*limit`.
- `limit` is the number of documents to show per page.
- `querySelector` is a mongo selector, like you would pass as the first argument to a call to `Docs.find()`.
- `queryOptions` are the mongo query options, like you would pass as the second argument to a call to `Docs.find()`.
  This must include at least `skip`, `limit` and `sort`. It's generally a good idea for the sort to provide a consistent ordering over the documents; one simple way to do this is to include the `_id` field as the last sort criterion.
- `handle` returned by the `CollectionPagers.publish` function has two properties:
  - `pageCursor` which is the cursor given by `Docs.find(querySelector, queryOptions)` and should be returned from the `Meteor.publish` function; and
  - `stop` which is a function that can be called to stop the observer that's used to maintain the counter and current list of document ids (see below). This isn't necessary in typical usage.

### Client side

On the client side, once you've subscribed to `'docsWithColour'` (to continue the example above):
```js
Meteor.subscribe('docsWithColour', myPagerId, 'blue', myPageNumber * myLimit, myLimit);
```
you can call three functions on `CollectionPagers`:
- `CollectionPagers.getTotalCount(pagerId)` is a reactive function that returns the total number of documents found by the `querySelector` above. Eg `CollectionPagers.getTotalCount(myPagerId)`.
- `CollectionPagers.getDocuments(pagerId, collection)` is a reactive function that retrieves the document objects for the current page. The `collection` argument is a reference to the relevant collection. **Note** This list is filtered to remove any documents that are not yet available on the client. This can happen momentarily when the current set of documents are still being transferred to the client from the server. Eg `CollectionPagers.getDocuments(myPagerId, Docs)`.
- `CollectionPagers.get(pagerId)` is a reactive function that returns an object with more details about the pager, including fields:
  - `totalCount` Same as `CollectionPagers.getTotalCount(pagerId)`
  - `skip` The current skip value.
  - `limit` The current limit value.
  - `currentIds` The ids for the documents in the current page.

  Eg `CollectionPagers.get(myPagerId)`.


## Options

### *(alpha)* fastCount
Eg: `{fastCount: true}`
Default: **false**

This is the equivalent of using a meteor method that returns the current count on a collection and then observing subsequent changes to the collection after skipping all documents in the initial count.

This change is not without trade-offs; things removed from your data set included in the initial count call will not be reflected in the total count. For most big counts it will not be noticeable if a count is slightly off, but still gives the user an idea of how the collection is growing.


## Acknowledgements

The code in this package was inspired by [ros:publish-counts](https://github.com/BrianRosamilia/publish-counts).
