export interface Command {
  do(): void;
  undo(): void;
  label: string;
}

export interface Identifiable {
  id: string;
}

export interface ObjectStore<T extends Identifiable> {
  add(obj: T): void;
  remove(id: string): void;
  update(id: string, obj: T): void;
  getAll(): T[];
}

export class AddObjectCommand<T extends Identifiable> implements Command {
  label = 'Add Object';
  constructor(private store: ObjectStore<T>, private obj: T) {}
  do() { this.store.add(this.obj); }
  undo() { this.store.remove(this.obj.id); }
}

export class RemoveObjectCommand<T extends Identifiable> implements Command {
  label = 'Remove Object';
  constructor(private store: ObjectStore<T>, private obj: T) {}
  do() { this.store.remove(this.obj.id); }
  undo() { this.store.add(this.obj); }
}

export class CompositeCommand implements Command {
  constructor(private commands: Command[], public label: string = 'Batch Action') {}
  do() {
    for (const cmd of this.commands) cmd.do();
  }
  undo() {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}

export class HistoryStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
  }

  execute(command: Command) {
    command.do();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift(); // Drop oldest
    }
    this.redoStack = []; // Clear redo stack on new action
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;
    
    command.undo();
    this.redoStack.push(command);
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;
    
    command.do();
    this.undoStack.push(command);
    return true;
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }
}
