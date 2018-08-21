import { Tinytest } from "meteor/tinytest";
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';


Docs = new Meteor.Collection('docs');

const queryOptions = {skip: 0, limit: 2, sort: ['index']};
const queryOptionsSkip2 = {skip: 2, limit: 2, sort: ['index']};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const arrayEqual = (a1, a2) => {
  if (!Array.isArray(a1) || !Array.isArray(a2) || a1.length != a2.length) return false;
  for (let i = 0; i < a1.length; i++) {
    if (a1[i] != a2[i]) return false;
  }
  return true;
}


if (Meteor.isServer) {
  Docs.allow({
    insert: function() {
      return true;
    },
    remove: function() {
      return true;
    },
    update: function() {
      return true;
    }
  });


  Meteor.methods({
    setup: function(testId) {
      Docs.remove({});
      for (let i = 0; i < 7; i++) {
        Docs.insert({ testId, index: i+1, set: i < 3 ? 'a' : 'b' });
      }
    },

    updateDoc: function(selector, change) {
      Docs.update(selector, change);
    },

    removeDoc: function(selector) {
      Docs.remove(selector);
    },
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
      const correctSequence = [3, 4, 5, 4];
      let sequenceIndex = 0;

      const timeout = Meteor.setTimeout(() => {
        test.exception(new Error("Test timed out before correct sequence."));
      }, 1000);

      Tracker.autorun((computation) => {
        const count = CollectionPagers.getTotalCount(testId);

        // The count can momentarily be incorrect as this computation can be rerun
        // when either the page cursor or the total count cursor is updated.
        if (count == correctSequence[sequenceIndex]) {
          test.equal(count, correctSequence[sequenceIndex]);

          sequenceIndex++;
          if (sequenceIndex == correctSequence.length) {
            Meteor.clearTimeout(timeout);
            computation.stop();
            done();
          }
        }
      });

      await sleep(100);
      docA = Docs.insert({ testId, index: 100, set: 'a' });
      await sleep(100);
      docB = Docs.insert({ testId, index: 101, set: 'b' });
      await sleep(100);
      Docs.insert({ testId, index: 102, set: 'a' });
      await sleep(100);
      Docs.remove(docA);
      await sleep(100);
      Docs.remove(docB);
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
      const sub = Meteor.subscribe('subsetASkip2', testId);

      // Correct sequence of values for the 'index' field for the returned documents.
      const correctSequence = [[3], [2, 3], [1.5, 2], [1.5]];
      let sequenceIndex = 0;

      const timeout = Meteor.setTimeout(() => {
        test.exception(new Error("Test timed out before correct sequence."));
      }, 1000);

      Tracker.autorun((computation) => {
        const cp =  CollectionPagers.get(testId);
        if (cp && cp.currentIds.length == correctSequence[sequenceIndex].length) {
          const docIndexes = cp.currentIds.map(id => Docs.findOne(id)).filter(d => !!d).map(d => d.index);

          // The docs can momentarily be incorrect as this computation can be rerun
          // when either the page cursor or the total count cursor is updated.
          if (arrayEqual(docIndexes, correctSequence[sequenceIndex])) {
            test.equal(docIndexes, correctSequence[sequenceIndex]);

            sequenceIndex++;
            if (sequenceIndex == 4) {
              Meteor.clearTimeout(timeout);
              computation.stop();
              done();
            }
          }
        }
      });

      await sleep(100);

      Docs.insert({ testId, index: 0, set: 'a' });
      await sleep(100);

      Meteor.call('updateDoc', { testId, index: 3, set: 'a' }, {$set: {index: 1.5}});
      await sleep(100);

      Meteor.call('removeDoc', { testId, index: 2, set: 'a' });
    });
  });

}
