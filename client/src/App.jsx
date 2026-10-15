import { useState } from 'react'
import { entities } from './entities.js'
import CrudPage from './CrudPage.jsx'

export default function App() {
  const [current, setCurrent] = useState('livros')

  return (
    <div className="layout">
      <nav>
        <h1>📚 Biblioteca</h1>
        {Object.entries(entities).map(([key, e]) => (
          <button
            key={key}
            className={key === current ? 'active' : ''}
            onClick={() => setCurrent(key)}
          >
            {e.title}
          </button>
        ))}
      </nav>
      <main>
        <CrudPage key={current} name={current} />
      </main>
    </div>
  )
}
