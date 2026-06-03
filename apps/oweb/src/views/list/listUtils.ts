import type {
  FieldElement,
  ListButtonElement,
  ListButtonGroup,
  ListColumn,
  ViewField,
} from '@odooseek/odoo-client'

export function viewFieldToFieldElement(vf: ViewField): FieldElement {
  return {
    type: 'field',
    name: vf.name,
    widget: vf.widget,
    string: vf.string,
    readonly: vf.readonly,
    required: vf.required,
  }
}

export function isListButton(col: ListColumn): col is ListButtonElement {
  return 'buttonType' in col
}

export function isButtonGroup(col: ListColumn): col is ListButtonGroup {
  return col.type === 'button_group'
}

export function isNonField(col: ListColumn): col is ListButtonElement | ListButtonGroup {
  return isListButton(col) || isButtonGroup(col)
}

export function isViewField(col: ListColumn): col is ViewField {
  return !isListButton(col) && !isButtonGroup(col)
}

export function defaultForType(type: string): unknown {
  if (type === 'boolean') return false
  if (type === 'integer' || type === 'float' || type === 'monetary') return 0
  return false
}
