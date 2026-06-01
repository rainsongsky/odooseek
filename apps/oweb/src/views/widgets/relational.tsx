/**
 * Compatibility entry after split into `relational/`.
 * Keeps Vite HMR and deep imports (`widgets/relational.tsx`) working.
 */
export {
  AttachmentImageWidget,
  Many2ManyCheckboxesWidget,
  Many2ManyTagsAvatarWidget,
  Many2ManyWidget,
} from './relational/many2many'
export { Many2OneAvatarWidget, Many2OneWidget } from './relational/many2one'
export { One2ManyWidget } from './relational/one2many'
