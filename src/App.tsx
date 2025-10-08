/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserWarning } from './UserWarning';
import { addTodo, getTodos, removeTodo, USER_ID } from './api/todos';
import { Todo } from './types/Todo';

type Filter = 'all' | 'active' | 'completed';

export const App: React.FC = () => {
  //#region state
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  //Felder zum Hinzufügen
  const [title, setTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  //local uninstall loaders
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  //#endregion

  //#region filter by hash
  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash.replace('#/', '');

      if (h === 'active' || h === 'completed') {
        setFilter(h);
      } else {
        setFilter('all');
      }
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);

    return () => window.removeEventListener('hashchange', applyHash);
  }, []);
  //#endregion

  //#region task loader
  useEffect(() => {
    if (!USER_ID) {
      return;
    }

    let timer: number | undefined;

    setIsLoading(true);
    setError('');

    getTodos()
      .then(setTodos)
      .catch(() => setError('Unable to load todos'))
      .finally(() => setIsLoading(false));

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const activeCount = useMemo(
    () => todos.filter(t => !t.completed).length,
    [todos],
  );

  const completedExist = useMemo(() => todos.some(t => t.completed), [todos]);

  const allCompleted = todos.length > 0 && activeCount === 0;

  const filteredTodos = useMemo<Todo[]>(() => {
    if (filter === 'active') {
      return todos.filter(t => !t.completed);
    }

    if (filter === 'completed') {
      return todos.filter(t => t.completed);
    }

    return todos;
  }, [todos, filter]);
  // #endregion

  // #region show error and submit
  const showError = (message: string) => {
    setError(message);
    window.setTimeout(() => setError(''), 3000);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = title.trim();

    if (!trimmed) {
      showError('Title should not be empty');

      return;
    }

    setIsAdding(true);
    setTempTodo({ id: 0, userId: USER_ID, title: trimmed, completed: false });

    addTodo(trimmed)
      .then(created => {
        setTodos(prev => [...prev, created]);
        setTitle('');
      })
      .catch(() => {
        showError('Unable to add a todo');
      })
      .finally(() => {
        setIsAdding(false);
        setTempTodo(null);
        inputRef.current?.focus();
      });
  };
  // #endregion

  // #region show error delete
  const startDeleting = (ids: number[]) =>
    setDeletingIds(prev => {
      const next = new Set(prev);

      ids.forEach(id => next.add(id));

      return next;
    });

  const stopDeleting = (ids: number[]) =>
    setDeletingIds(prev => {
      const next = new Set(prev);

      ids.forEach(id => next.delete(id));

      return next;
    });

  const handleDeleteOne = (id: number) => {
    startDeleting([id]);

    removeTodo(id)
      .then(() => {
        setTodos(prev => prev.filter(t => t.id !== id));
      })
      .catch(() => {
        showError('Unable to delete a todo');
      })
      .finally(() => {
        stopDeleting([id]);
      });
  };

  const handleClearCompleted = () => {
    const ids = todos.filter(t => t.completed).map(t => t.id);

    if (ids.length === 0) {
      return;
    }

    startDeleting(ids);

    Promise.allSettled(
      ids.map(id =>
        removeTodo(id)
          .then(() => {
            setTodos(prev => prev.filter(t => t.id !== id));
          })
          .catch(() => {
            showError('Unable to delete a todo');
          }),
      ),
    ).finally(() => {
      stopDeleting(ids);
    });
  };

  // #endregion

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {/* this button should have `active` class only if all todos are completed */}
          <button
            type="button"
            className={`todoapp__toggle-all ${allCompleted ? 'active' : ''}`}
            data-cy="ToggleAllButton"
            disabled
          />

          {/* Add a todo on form submit */}
          <form onSubmit={handleAdd}>
            <input
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={isLoading || isAdding}
              autoFocus
            />
          </form>
        </header>

        {todos.length > 0 && (
          <section className="todoapp__main" data-cy="TodoList">
            {filteredTodos.map(todo => (
              <div
                key={todo.id}
                data-cy="Todo"
                className={`todo ${todo.completed ? 'completed' : ''}`}
              >
                <label className="todo__status-label">
                  <input
                    data-cy="TodoStatus"
                    type="checkbox"
                    className="todo__status"
                    checked={todo.completed}
                    readOnly
                  />
                </label>

                <span data-cy="TodoTitle" className="todo__title">
                  {todo.title}
                </span>

                <button
                  type="button"
                  className="todo__remove"
                  data-cy="TodoDelete"
                  onClick={() => handleDeleteOne(todo.id)}
                  disabled={deletingIds.has(todo.id)}
                >
                  ×
                </button>

                <div
                  data-cy="TodoLoader"
                  className={`modal overlay ${isLoading ? 'is-active' : ''}`}
                >
                  <div className="modal-background has-background-white-ter" />
                  <div className="loader" />
                </div>
              </div>
            ))}
          </section>
        )}

        {tempTodo && (
          <section className="todoapp__main">
            <div data-cy="Todo" className="todo">
              <label className="todo__status-label">
                <input
                  data-cy="TodoStatus"
                  type="checkbox"
                  className="todo__status"
                  checked={false}
                  readOnly
                />
              </label>

              <span data-cy="TodoTitle" className="todo__title">
                {tempTodo.title}
              </span>

              <button
                type="button"
                className="todo__remove"
                data-cy="TodoDelete"
                disabled
              >
                ×
              </button>

              <div data-cy="TodoLoader" className="modal overlay is-active">
                <div className="modal-background has-background-white-ter" />
                <div className="loader" />
              </div>
            </div>
          </section>
        )}

        {/* Hide the footer if there are no todos */}
        {todos.length > 0 && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span className="todo-count" data-cy="TodosCounter">
              {activeCount} item{activeCount !== 1 ? 's' : ''} left
            </span>

            {/* Active link should have the 'selected' class */}
            <nav className="filter" data-cy="Filter">
              <a
                href="#/"
                className={`filter__link selected ${filter === 'all' ? 'selected' : ''}`}
                data-cy="FilterLinkAll"
              >
                All
              </a>

              <a
                href="#/active"
                className={`filter__link selected ${filter === 'active' ? 'selected' : ''}`}
                data-cy="FilterLinkActive"
              >
                Active
              </a>

              <a
                href="#/completed"
                className={`filter__link selected ${filter === 'completed' ? 'selected' : ''}`}
                data-cy="FilterLinkCompleted"
              >
                Completed
              </a>
            </nav>

            {/* this button should be disabled if there are no completed todos */}
            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              onClick={handleClearCompleted}
              disabled={!completedExist || deletingIds.size > 0}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      {/* DON'T use conditional rendering to hide the notification */}
      {/* Add the 'hidden' class to hide the message smoothly */}
      <div
        data-cy="ErrorNotification"
        className={`notification is-danger is-light has-text-weight-normal ${error ? '' : 'hidden'}`}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={() => setError('')}
        />
        {/* show only one message at a time */}
        {error}
      </div>
    </div>
  );
};
