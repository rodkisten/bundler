# Fabrica Elements Changelog

## Next

### Added

- Added named styled tag/component builders with both `.css`` ` and direct tagged-template forms.
- Added automatic structural Fabrica registry integration with delayed-load queuing and shared bundle readiness notifications.
- Added `warn`, `replace`, `error` and `ignore` registry collision policies.
- Added styled component metadata and lifecycle helpers: `className`, `artifact`, `displayName`, `tag`, `registeredName`, `register()`, `unregister()` and `withComponent()`.
- Added object/function attrs, polymorphic `as`, `styled.component(name, options)` and named wrapping of existing components.
- Added focused tests and benchmark coverage for registry resolution and named styled component creation.

### Changed

- Native HTML tag properties on `StyledFactory` are now strongly typed instead of falling through an `unknown` string index.
- Registry readiness listeners are attached only while queued components exist and are released after the queue flushes.
