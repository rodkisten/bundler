/** Event modifiers parsed from `@click.prevent.passive` syntax. */
export type EventBindingConfig = {
  name: string;
  prevent: boolean;
  stop: boolean;
  /** Explicit `.delegate` preference. */
  delegate: boolean;
  /** Explicit `.direct` opt-out from automatic delegation. */
  direct: boolean;
  options: AddEventListenerOptions;
};
