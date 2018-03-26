import { Tinytest } from "meteor/tinytest";
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker'


Docs = new Meteor.Collection('docs');

const queryOptions = {skip: 0, limit: 2, sort: ['index']};
const queryOptionsSkip2 = {skip: 2, limit: 2, sort: ['index']};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


if (Meteor.isServer) {
  Docs.allow({
    insert: function() {
      return true;
    },
    remove: function() {
      return true;
    }
  });


  Meteor.methods({
    setup: function(testId) {
      for (let i = 0; i < 7; i++)
        Docs.insert({ testId, index: i+1, set: i < 3 ? 'a' : 'b' });
    }
  });


  Meteor.publish('all', function(testId) {
    return CollectionPagers.publish(this, testId, Docs, {testId}, queryOptions).pageCursor;
  });

  Meteor.publish('subsetA', function(testId) {
    return CollectionPagers.publish(this, testId, Docs, {testId, set: 'a'}, queryOptions).pageCursor;
  });

  Meteor.publish('subsetASkip2', function(testId) {
    return CollectionPagers.publish(this, testId, Docs, {testId, set: 'a'}, queryOptionsSkip2).pageCursor;
  });

}


if (Meteor.isClient) {

  Tinytest.addAsync("Total count - all documents", function(test, done) {
    Meteor.call('setup', test.runId(), function() {
      Meteor.subscribe('all', test.runId(), function() {
        test.equal(CollectionPagers.getTotalCount(test.runId()), 7);
        done();
      });
    });
  });

  Tinytest.addAsync("Total count - selected subset", function(test, done) {
    Meteor.call('setup', test.runId(), function() {
      Meteor.subscribe('subsetA', test.runId(), function() {
        test.equal(CollectionPagers.getTotalCount(test.runId()), 3);
        done();
      });
    });
  });

  Tinytest.addAsync("Total count - updated on add and remove", function(test, done) {
    const testId = test.runId();
    Meteor.call('setup', testId, async function() {
      const sub = Meteor.subscribe('subsetA', testId);

      // Correct sequence of values for the 'index' field for the returned documents.
      const correctSequence = [3, 4, 4, 5, 4, 4];
      let sequenceIndex = 0;

      const timeout = Meteor.setTimeout(() => {
        test.exception(new Error("Test timed out before correct sequence."));
      }, 3000);

      Tracker.autorun(() => {
        const count = CollectionPagers.getTotalCount(testId);

        // The count can momentarily be incorrect as this computation can be rerun
        // when either the page cursor or the collectionpagers collection is updated.
        if (count == correctSequence[sequenceIndex]) {
          test.equal(count, correctSequence[sequenceIndex]);

          sequenceIndex++;
          if (sequenceIndex == correctSequence.length) {
            Meteor.clearTimeout(timeout);
            done();
          }
        }
      });

      await sleep(200);
      docA = Docs.insert({ testId, index: 100, set: 'a' });
      await sleep(200);
      docB = Docs.insert({ testId, index: 101, set: 'b' });
      await sleep(200);
      Docs.insert({ testId, index: 102, set: 'a' });
      await sleep(200);
      Docs.remove(docA);
      await sleep(200);
      Docs.remove(docB);
      done();
    });
  });

  Tinytest.addAsync("getDocuments - initial correct skip 0", function(test, done) {
    const testId = test.runId();
    Meteor.call('setup', testId, function() {
      Meteor.subscribe('subsetA', testId, function() {
        const docIndexesGiven = CollectionPagers.getDocuments(testId, Docs).map(d => d.index);
        test.equal(docIndexesGiven, [1, 2]);
        done();
      });
    });
  });

  Tinytest.addAsync("getDocuments - initial correct skip 2", function(test, done) {
    const testId = test.runId();
    Meteor.call('setup', testId, function() {
      Meteor.subscribe('subsetASkip2', testId, function() {
        const docIndexesGiven = CollectionPagers.getDocuments(testId, Docs).map(d => d.index);
        test.equal(docIndexesGiven, [3]);
        done();
      });
    });
  });

  Tinytest.addAsync("getDocuments - changed correct", function(test, done) {
    const testId = test.runId();
    Meteor.call('setup', testId, async function() {
      const sub = Meteor.subscribe('subsetA', testId);

      // Correct sequence of values for the 'index' field for the returned documents.
      const correctSequence = [[1, 2], [0, 1], [1, 2]];
      let sequenceIndex = 0;

      const timeout = Meteor.setTimeout(() => {
        test.exception(new Error("Test timed out before correct sequence."));
      }, 3000);

      Tracker.autorun(() => {
        const docIndexes = CollectionPagers.getDocuments(testId, Docs).map(d => d.index);

        // If the subscription isn't ready or not all documents have been transferred to the client yet.
        if (!sub.ready() || docIndexes.length != 2) return;

        test.equal(docIndexes, correctSequence[sequenceIndex]);

        sequenceIndex++;
        if (sequenceIndex == 3) {
          Meteor.clearTimeout(timeout);
          done();
        }
      });

      await sleep(200);

      docA = Docs.insert({ testId, index: 0, set: 'a' });
      await sleep(200);

      docA = Docs.remove(docA);
      await sleep(200);
    });
  });

}
