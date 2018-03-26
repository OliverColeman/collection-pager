Package.describe({
  name: 'ojc:collection-pager',
  version: '1.0.0',
  // Brief, one-line summary of the package.
  summary: 'A Meteor package making it easy to create reactive, performant pagers.',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/OliverColeman/collection-pager',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.6.1');
  api.use('ecmascript');
  api.use('mongo');
  api.export('CollectionPagers');
  api.mainModule('collection-pager.js');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('ojc:collection-pager');
  api.mainModule('collection-pager-tests.js');
});
