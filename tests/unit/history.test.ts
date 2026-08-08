import { describe, it, expect } from 'vitest';
import { HistoryStack, type Command, type ObjectStore, type Identifiable } from '../../src/history/command.ts';

interface TestObj extends Identifiable {
  id: string;
  value: string;
}

class TestStore implements ObjectStore<TestObj> {
  private map = new Map<string, TestObj>();
  
  add(obj: TestObj): void {
    this.map.set(obj.id, obj);
  }
  remove(id: string): void {
    this.map.delete(id);
  }
  update(id: string, obj: TestObj): void {
    if (this.map.has(id)) {
      this.map.set(id, obj);
    }
  }
  getAll(): TestObj[] {
    return Array.from(this.map.values());
  }
}

class AddObjectCommand implements Command {
  label = 'Add Object';
  constructor(private store: ObjectStore<TestObj>, private obj: TestObj) {}
  do() {
    this.store.add(this.obj);
  }
  undo() {
    this.store.remove(this.obj.id);
  }
}

class DummyCommand implements Command {
  label = 'Dummy';
  do() { /* dummy */ }
  undo() { /* dummy */ }
}

describe('HistoryStack', () => {
  it('execute/undo/redo correctly reverse and reapply a simple add-object Command', () => {
    const store = new TestStore();
    const history = new HistoryStack(10);
    const obj: TestObj = { id: '1', value: 'hello' };
    
    // Execute
    history.execute(new AddObjectCommand(store, obj));
    expect(store.getAll()).toHaveLength(1);
    expect(store.getAll()[0].value).toBe('hello');
    
    // Undo
    const undone = history.undo();
    expect(undone).toBe(true);
    expect(store.getAll()).toHaveLength(0);
    
    // Redo
    const redone = history.redo();
    expect(redone).toBe(true);
    expect(store.getAll()).toHaveLength(1);
    expect(store.getAll()[0].id).toBe('1');
  });

  it('respects its size cap (oldest entries drop when exceeded)', () => {
    const history = new HistoryStack(5); // max size 5
    
    for (let i = 0; i < 7; i++) {
      history.execute(new DummyCommand());
    }
    
    expect(history.getUndoCount()).toBe(5); // Only 5 items kept
    
    // We should be able to undo exactly 5 times
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(false); // 6th undo fails
  });
  
  it('clears redo stack on new execute', () => {
    const history = new HistoryStack(5);
    history.execute(new DummyCommand());
    history.undo();
    expect(history.getRedoCount()).toBe(1);
    
    history.execute(new DummyCommand());
    expect(history.getRedoCount()).toBe(0);
  });
});
