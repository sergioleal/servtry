import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import { entities } from './entities.js'

const optionPairs = (options) => options.map((o) => (Array.isArray(o) ? o : [o, o]))

const emptyForm = (fields) => Object.fromEntries(fields.map((f) => [f.name, f.default ?? '']))

export default function CrudPage({ name }) {
  const entity = entities[name]
  const [rows, setRows] = useState([])
  const [refs, setRefs] = useState({})
  const [form, setForm] = useState(() => emptyForm(entity.fields))
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    try {
      const query = filter ? `?${new URLSearchParams({ [entity.filter.param]: filter })}` : ''
      setRows(await api('GET', name + query))
      const refNames = [...new Set(entity.fields.filter((f) => f.ref).map((f) => f.ref))]
      const lists = await Promise.all(refNames.map((r) => api('GET', r)))
      setRefs(Object.fromEntries(refNames.map((r, i) => [r, lists[i]])))
    } catch (err) {
      setError(err.message)
    }
  }, [name, entity, filter])

  useEffect(() => {
    load()
  }, [load])

  const show = (field, value) => {
    if (value == null || value === '') return '—'
    if (field.options) return optionPairs(field.options).find(([v]) => v === value)?.[1] ?? value
    if (!field.ref) return value
    const row = refs[field.ref]?.find((r) => r.id === value)
    return row ? entities[field.ref].label(row) : `#${value}`
  }

  const run = async (fn) => {
    setError('')
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const reset = () => {
    setForm(emptyForm(entity.fields))
    setEditingId(null)
  }

  const submit = (e) => {
    e.preventDefault()
    const editable = entity.fields.filter(
      (f) => !f.readOnly && !(editingId && f.createOnly),
    )
    const body = Object.fromEntries(editable.map((f) => [f.name, form[f.name]]))
    run(async () => {
      await (editingId ? api('PUT', `${name}/${editingId}`, body) : api('POST', name, body))
      reset()
    })
  }

  const edit = (row) => {
    setEditingId(row.id)
    setForm(Object.fromEntries(entity.fields.map((f) => [f.name, row[f.name] ?? ''])))
  }

  const remove = (row) => {
    if (confirm(`Excluir ${entity.label(row)}?`)) run(() => api('DELETE', `${name}/${row.id}`))
  }

  const input = (f) => {
    const disabled = f.readOnly || (editingId && f.createOnly)
    const common = {
      id: f.name,
      value: form[f.name],
      required: f.required && !disabled,
      disabled,
      onChange: (e) => setForm({ ...form, [f.name]: e.target.value }),
    }
    if (f.ref || f.options) {
      const options = f.ref
        ? (refs[f.ref] ?? []).map((r) => [r.id, entities[f.ref].label(r)])
        : optionPairs(f.options)
      return (
        <select {...common}>
          <option value="">—</option>
          {options.map(([value, text]) => (
            <option key={value} value={value} disabled={f.lockedOptions?.includes(value)}>
              {text}
            </option>
          ))}
        </select>
      )
    }
    return <input type={f.type ?? 'text'} {...common} />
  }

  return (
    <>
      <h2>{entity.title}</h2>

      <form onSubmit={submit}>
        {entity.fields
          .filter((f) => !(f.readOnly && !editingId))
          .map((f) => (
            <label key={f.name} htmlFor={f.name}>
              {f.label}
              {input(f)}
            </label>
          ))}
        <div className="actions">
          <button type="submit">{editingId ? 'Salvar' : 'Adicionar'}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={reset}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {entity.filter && (
        <label className="filter">
          {entity.filter.label}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {entity.filter.options.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              {entity.fields.map((f) => (
                <th key={f.name}>{f.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={entity.rowClass?.(row)}>
                <td>{row.id}</td>
                {entity.fields.map((f) => (
                  <td key={f.name}>
                    {show(f, row[f.name])}
                    {f.badge?.(row) && <span className="badge">{f.badge(row)}</span>}
                  </td>
                ))}
                <td className="row-actions">
                  {name === 'emprestimos' && !row.data_devolucao && (
                    <button onClick={() => run(() => api('POST', `emprestimos/${row.id}/devolucao`))}>
                      Devolver
                    </button>
                  )}
                  <button className="secondary" onClick={() => edit(row)}>
                    Editar
                  </button>
                  <button className="danger" onClick={() => remove(row)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={entity.fields.length + 2} className="empty">
                  Nenhum registro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
