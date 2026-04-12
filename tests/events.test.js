'use strict';

jest.mock('../src/models', () => ({
  Block: {
    findOne: jest.fn(),
    find: jest.fn(),
  },
  BlockEvent: {
    findById: jest.fn(),
    find: jest.fn(),
  },
}));

const { Block, BlockEvent } = require('../src/models');
const eventService = require('../src/services/eventService');

const makeBlock = (overrides = {}) => ({
  _id: 'block001',
  userId: 'user001',
  plots: new Map(),
  population: 10,
  activeEventId: null,
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const makeEvent = (overrides = {}) => ({
  _id: 'event001',
  name: 'Crime is rising at night',
  category: 'safety',
  effect: 'negative',
  populationImpact: -3,
  resolutionBuilding: {
    buildingTemplateId: 'tpl_police',
    minLevel: 1,
  },
  resolutionMission: { missionTemplateId: null },
  duration: 7,
  isActive: true,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('eventService', () => {
  describe('assignWeeklyEvents', () => {
    it('assigns an event to each block without an active event', async () => {
      const events = [makeEvent()];
      const blocks = [makeBlock(), makeBlock({ _id: 'block002', userId: 'user002' })];

      BlockEvent.find.mockResolvedValue(events);
      Block.find.mockResolvedValue(blocks);

      const result = await eventService.assignWeeklyEvents();
      expect(result.assigned).toBe(2);
      for (const block of blocks) {
        expect(block.activeEventId).toBe(events[0]._id);
        expect(block.save).toHaveBeenCalled();
      }
    });

    it('returns 0 assigned when no events exist', async () => {
      BlockEvent.find.mockResolvedValue([]);
      const result = await eventService.assignWeeklyEvents();
      expect(result.assigned).toBe(0);
    });

    it('returns 0 assigned when all blocks already have active events', async () => {
      BlockEvent.find.mockResolvedValue([makeEvent()]);
      Block.find.mockResolvedValue([]); // findOne with activeEventId: null returns nothing
      const result = await eventService.assignWeeklyEvents();
      expect(result.assigned).toBe(0);
    });
  });

  describe('checkEventResolution', () => {
    it('returns canResolve: true when block has the required building at min level', async () => {
      const event = makeEvent();
      const block = makeBlock({ activeEventId: 'event001' });
      block.plots.set('0,0', { buildingTemplateId: 'tpl_police', level: 1 });

      Block.findOne.mockResolvedValue(block);
      BlockEvent.findById.mockResolvedValue(event);

      const result = await eventService.checkEventResolution('user001', 'event001');
      expect(result.canResolve).toBe(true);
      expect(result.method).toBe('building');
    });

    it('returns canResolve: false when building is present but below minLevel', async () => {
      const event = makeEvent({
        resolutionBuilding: { buildingTemplateId: 'tpl_police', minLevel: 2 },
      });
      const block = makeBlock({ activeEventId: 'event001' });
      block.plots.set('0,0', { buildingTemplateId: 'tpl_police', level: 1 }); // only level 1

      Block.findOne.mockResolvedValue(block);
      BlockEvent.findById.mockResolvedValue(event);

      const result = await eventService.checkEventResolution('user001', 'event001');
      expect(result.canResolve).toBe(false);
    });

    it('returns canResolve: false when block has no resolution building', async () => {
      const event = makeEvent();
      const block = makeBlock({ activeEventId: 'event001' });
      // No plots with matching building

      Block.findOne.mockResolvedValue(block);
      BlockEvent.findById.mockResolvedValue(event);

      const result = await eventService.checkEventResolution('user001', 'event001');
      expect(result.canResolve).toBe(false);
    });

    it('throws VALIDATION_ERROR when event is not active on user block', async () => {
      const block = makeBlock({ activeEventId: 'event999' }); // different event
      Block.findOne.mockResolvedValue(block);

      await expect(
        eventService.checkEventResolution('user001', 'event001')
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('throws NOT_FOUND when block does not exist', async () => {
      Block.findOne.mockResolvedValue(null);

      await expect(
        eventService.checkEventResolution('user001', 'event001')
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('resolveEvent', () => {
    it('clears activeEventId on successful resolution', async () => {
      const event = makeEvent();
      const block = makeBlock({ activeEventId: 'event001' });
      block.plots.set('0,0', { buildingTemplateId: 'tpl_police', level: 1 });

      Block.findOne
        .mockResolvedValueOnce(block) // checkEventResolution
        .mockResolvedValueOnce(block); // resolveEvent

      BlockEvent.findById.mockResolvedValue(event);

      const result = await eventService.resolveEvent('user001', 'event001');
      expect(result.resolved).toBe(true);
      expect(block.activeEventId).toBeNull();
      expect(block.save).toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR when resolution conditions are not met', async () => {
      const event = makeEvent();
      const block = makeBlock({ activeEventId: 'event001' });
      // No matching building in plots

      Block.findOne.mockResolvedValue(block);
      BlockEvent.findById.mockResolvedValue(event);

      await expect(eventService.resolveEvent('user001', 'event001')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('applyUnresolvedEvents', () => {
    it('reduces population on blocks with unresolved negative events', async () => {
      const event = makeEvent({ effect: 'negative', populationImpact: -3 });
      const block = makeBlock({ activeEventId: event, population: 10 });

      Block.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([block]) });

      const result = await eventService.applyUnresolvedEvents();
      expect(result.affected).toBe(1);
      expect(block.population).toBe(7);
      expect(block.activeEventId).toBeNull();
      expect(block.save).toHaveBeenCalled();
    });

    it('does not affect blocks with positive events', async () => {
      const event = makeEvent({ effect: 'positive', populationImpact: 3 });
      const block = makeBlock({ activeEventId: event, population: 10 });

      Block.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([block]) });

      const result = await eventService.applyUnresolvedEvents();
      expect(result.affected).toBe(0);
      expect(block.population).toBe(10);
    });

    it('does not let population go below zero', async () => {
      const event = makeEvent({ effect: 'negative', populationImpact: -50 });
      const block = makeBlock({ activeEventId: event, population: 3 });

      Block.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([block]) });

      await eventService.applyUnresolvedEvents();
      expect(block.population).toBe(0);
    });
  });
});
