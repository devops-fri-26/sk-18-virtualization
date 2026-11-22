
import { useEffect, useState } from 'react'
import { apiRequest } from './api'
import './App.css'
import './messaging.css'

type User = {
  id: number
  email: string
  display_name: string
}

type Item = {
    id: number
    owner_id?: number
    title: string
    description?: string
    category: string
    image_path?: string
    created_at: string
    owner_name: string
    status?: string
}

type Offer = {
  id: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  offered_item_id: number
  offered_title: string
  offered_image?: string
  requested_item_id: number
  requested_title: string
  requested_image?: string
  other_user: string
}

type Message = {
  id: number
  sender_id: number
  sender_name?: string
  display_name?: string
  body: string
  created_at: string
}

const categories = [
  { value: '', label: 'All items' },
  { value: 'oblacila', label: 'Clothing' },
  { value: 'elektronika', label: 'Electronics' },
  { value: 'knjige', label: 'Books' },
  { value: 'sport', label: 'Sports' },
  { value: 'dom', label: 'Home' },
]

function App() {
    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [token, setToken] = useState<string | null>(
    sessionStorage.getItem('token'),
    )
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [items, setItems] = useState<Item[]>([])
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('')
    const [itemsLoading, setItemsLoading] = useState(false)
    const [itemsError, setItemsError] = useState('')
    const [showAddForm, setShowAddForm] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [newCategory, setNewCategory] = useState('oblacila')
    const [newImage, setNewImage] = useState<File | null>(null)
    const [addError, setAddError] = useState('')
    const [adding, setAdding] = useState(false)

    const [selectedItem, setSelectedItem] = useState<Item | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState('')

    const [showOfferForm, setShowOfferForm] = useState(false)
    const [myItems, setMyItems] = useState<Item[]>([])
    const [selectedOfferItem, setSelectedOfferItem] = useState('')
    const [offerLoading, setOfferLoading] = useState(false)
    const [offerSubmitting, setOfferSubmitting] = useState(false)
    const [offerError, setOfferError] = useState('')
    const [offerSuccess, setOfferSuccess] = useState('')

    const [currentView, setCurrentView] = useState<'marketplace' | 'offers'>('marketplace')
    const [offerBox, setOfferBox] = useState<'received' | 'sent'>('received')
    const [offers, setOffers] = useState<Offer[]>([])
    const [offersLoading, setOffersLoading] = useState(false)
    const [offersError, setOffersError] = useState('')
    const [updatingOffer, setUpdatingOffer] = useState<number | null>(null)
    const [activeChatOfferId, setActiveChatOfferId] = useState<number | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [messageDraft, setMessageDraft] = useState('')
    const [messagesLoading, setMessagesLoading] = useState(false)
    const [messagesError, setMessagesError] = useState('')
    const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    if (!token) return

    apiRequest<User>('/me', {}, token)
      .then(setUser)
      .catch(() => {
        sessionStorage.removeItem('token')
        setToken(null)
      })
  }, [token])

  useEffect(() => {
    if (!token || !user) return

    const params = new URLSearchParams()

    if (search.trim()) params.set('q', search.trim())
    if (category) params.set('category', category)

    setItemsLoading(true)
    setItemsError('')

    apiRequest<Item[]>(`/items?${params.toString()}`, {}, token)
      .then(setItems)
      .catch((err) => {
        setItemsError(err instanceof Error ? err.message : 'Could not load items')
      })
      .finally(() => setItemsLoading(false))
  }, [token, user, search, category])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'register') {
        await apiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, displayName }),
        })
      }

      const result = await apiRequest<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      sessionStorage.setItem('token', result.token)
      setToken(result.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    try {
      if (token) {
        await apiRequest('/auth/logout', { method: 'POST' }, token)
      }
    } catch {
      // Clear the local session even if the server request fails.
    }

    sessionStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setItems([])
    setOfferSuccess('')
    setOfferError('')
    setShowOfferForm(false)
    setSelectedOfferItem('')
    setMyItems([])
    setActiveChatOfferId(null)
    setMessages([])
    setMessageDraft('')
  }

async function loadOffers(box: 'received' | 'sent') {
  if (!token) return

  setOffersLoading(true)
  setOffersError('')
  setOfferBox(box)

  try {
    const result = await apiRequest<Offer[]>(
      `/offers?box=${box}`,
      {},
      token,
    )

    setOffers(result)
  } catch (err) {
    setOffersError(
      err instanceof Error ? err.message : 'Could not load offers',
    )
  } finally {
    setOffersLoading(false)
  }
}

async function loadMessages(offerId: number, showLoading = false) {
  if (!token) return
  if (showLoading) setMessagesLoading(true)
  setMessagesError('')

  try {
    const result = await apiRequest<Message[]>(
      `/offers/${offerId}/messages`,
      {},
      token,
    )
    setMessages(result)
  } catch (err) {
    setMessagesError(err instanceof Error ? err.message : 'Could not load messages')
  } finally {
    if (showLoading) setMessagesLoading(false)
  }
}

async function openChat(offerId: number) {
  setActiveChatOfferId(offerId)
  setMessages([])
  setMessageDraft('')
  await loadMessages(offerId, true)
}

async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  if (!token || activeChatOfferId === null || !messageDraft.trim()) return

  setSendingMessage(true)
  setMessagesError('')
  try {
    await apiRequest(`/offers/${activeChatOfferId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: messageDraft.trim() }),
    }, token)
    setMessageDraft('')
    await loadMessages(activeChatOfferId)
  } catch (err) {
    setMessagesError(err instanceof Error ? err.message : 'Could not send message')
  } finally {
    setSendingMessage(false)
  }
}

useEffect(() => {
  if (!token || activeChatOfferId === null) return

  const refreshConversation = async () => {
    try {
      const result = await apiRequest<Message[]>(
        `/offers/${activeChatOfferId}/messages`,
        {},
        token,
      )
      setMessages(result)
    } catch (err) {
      setMessagesError(err instanceof Error ? err.message : 'Could not refresh messages')
    }
  }

  const timer = window.setInterval(refreshConversation, 5000)
  return () => window.clearInterval(timer)
}, [token, activeChatOfferId])

async function updateOffer(id: number, status: 'accepted' | 'rejected') {
  if (!token) return

  setUpdatingOffer(id)
  setOffersError('')

  try {
    await apiRequest(`/offers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, token)

    await loadOffers(offerBox)
  } catch (err) {
    setOffersError(
      err instanceof Error ? err.message : 'Could not update offer',
    )
  } finally {
    setUpdatingOffer(null)
  }
}


async function openItem(itemId: number) {
  if (!token) return

    setOfferSuccess('')
    setOfferError('')
    setShowOfferForm(false)
    setSelectedOfferItem('')
    setDetailLoading(true)
    setDetailError('')
    setSelectedItem(null)

  try {
    const item = await apiRequest<Item>(
      `/items/${itemId}`,
      {},
      token,
    )

    setSelectedItem(item)
  } catch (err) {
    setDetailError(
      err instanceof Error ? err.message : 'Could not load item',
    )
  } finally {
    setDetailLoading(false)
  }
}

async function handleShowOfferForm() {
  if (!token || !selectedItem) return

  setShowOfferForm(true)
  setOfferError('')
  setOfferSuccess('')
  setSelectedOfferItem('')
  setOfferLoading(true)

  try {
    const result = await apiRequest<Item[]>(
      '/items/mine',
      {},
      token,
    )

    const availableItems = result.filter(
      (item) => item.status === 'available'
        && item.id !== selectedItem.id,
    )

    setMyItems(availableItems)
  } catch (err) {
    setOfferError(
      err instanceof Error ? err.message : 'Could not load your items',
    )
  } finally {
    setOfferLoading(false)
  }
}

async function handleSubmitOffer(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()

  if (!token || !selectedItem || !selectedOfferItem) return

  setOfferSubmitting(true)
  setOfferError('')
  setOfferSuccess('')

  try {
    await apiRequest('/offers', {
      method: 'POST',
      body: JSON.stringify({
        offeredItemId: Number(selectedOfferItem),
        requestedItemId: selectedItem.id,
      }),
    }, token)

    setOfferSuccess('Your offer was sent successfully!')
    setShowOfferForm(false)
    setSelectedOfferItem('')
  } catch (err) {
    setOfferError(
      err instanceof Error ? err.message : 'Could not send offer',
    )
  } finally {
    setOfferSubmitting(false)
  }
}



async function handleAddItem(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()

  if (!token) return

  setAdding(true)
  setAddError('')

  try {
    const formData = new FormData()
    formData.append('title', newTitle)
    formData.append('description', newDescription)
    formData.append('category', newCategory)

    if (newImage) {
      formData.append('image', newImage)
    }

    await apiRequest('/items', {
      method: 'POST',
      body: formData,
    }, token)

    setNewTitle('')
    setNewDescription('')
    setNewCategory('oblacila')
    setNewImage(null)
    setShowAddForm(false)

    // Refresh the marketplace.
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (category) params.set('category', category)

    const updatedItems = await apiRequest<Item[]>(
      `/items?${params.toString()}`,
      {},
      token,
    )

    setItems(updatedItems)
  } catch (err) {
    setAddError(err instanceof Error ? err.message : 'Could not add item')
  } finally {
    setAdding(false)
  }
}


  if (token && !user) {
    return <main className="page"><p>Loading your account...</p></main>
  }


if (user && detailLoading) {
  return (
    <main className="page">
      <p>Loading item details...</p>
    </main>
  )
}

if (user && detailError) {
  return (
    <main className="page">
      <button
        className="secondary-button"
        onClick={() => setDetailError('')}
      >
        Back to marketplace
      </button>
      <p className="error">{detailError}</p>
    </main>
  )
}

if (user && selectedItem) {
  const itemCategory =
    categories.find((c) => c.value === selectedItem.category)?.label
    ?? selectedItem.category

  return (
    <main className="page">
    <header className="topbar">
      <h1>Barter<span>App</span></h1>
      <button className="secondary-button" onClick={handleLogout}>
        Log out
      </button>
    </header>

      <section className="detail-page">
        <button
          className="back-button"
          onClick={() => setSelectedItem(null)}
        >
          ← Back to marketplace
        </button>

        <div className="detail-card">
          <div className="detail-image">
            {selectedItem.image_path ? (
              <img
                src={`/api${selectedItem.image_path.startsWith('/') ? '' : '/'}${selectedItem.image_path}`}
                alt={selectedItem.title}
              />
            ) : (
              <span>📦</span>
            )}
          </div>

          <div className="detail-content">
            <span className="category-label">{itemCategory}</span>
            <h2>{selectedItem.title}</h2>

            <p className="detail-description">
              {selectedItem.description || 'No description provided.'}
            </p>

            <div className="detail-owner">
              <span>Listed by</span>
              <strong>{selectedItem.owner_name}</strong>
            </div>

            {selectedItem.owner_id !== user.id && (
              <button
                className="primary-button detail-offer-button"
                onClick={handleShowOfferForm}
              >
                Make an offer
              </button>
            )}

            {offerSuccess && <p className="success">{offerSuccess}</p>}

            {showOfferForm && (
              <form className="add-item-form" onSubmit={handleSubmitOffer}>
                <h3>Choose an item to offer</h3>

                {offerLoading && <p>Loading your items...</p>}

                {!offerLoading && myItems.length === 0 && (
                  <p>You don't have any other available items to offer.</p>
                )}

                {!offerLoading && myItems.length > 0 && (
                  <label>
                    Your item
                    <select
                      value={selectedOfferItem}
                      onChange={(event) => setSelectedOfferItem(event.target.value)}
                      required
                    >
                      <option value="">Select an item</option>
                      {myItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {offerError && <p className="error">{offerError}</p>}

                <div className="form-actions">
                  <button
                    className="primary-button"
                    disabled={offerSubmitting || offerLoading || myItems.length === 0 || !selectedOfferItem}
                  >
                    {offerSubmitting ? 'Sending...' : 'Send offer'}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowOfferForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}


  if (user) {
    return (
      <main className="page">
        <header className="topbar">
          <h1>Barter<span>App</span></h1>

          <div className="user-controls">
            <span>Hi, {user.display_name}</span>

            <button
              className="secondary-button"
              onClick={() => setCurrentView('marketplace')}
            >
              Marketplace
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                setCurrentView('offers')
                loadOffers('received')
              }}
            >
              My offers
            </button>

            <button className="secondary-button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        {currentView === 'offers' ? (
          <section className="marketplace">
            <div className="market-heading">
              <p className="eyebrow">YOUR EXCHANGES</p>
              <h2>My offers</h2>
              <p>Manage the items you want to exchange.</p>
            </div>

            <div className="market-actions">
              <button
                className={offerBox === 'received' ? 'primary-button' : 'secondary-button'}
                onClick={() => loadOffers('received')}
              >
                Received
              </button>

              <button
                className={offerBox === 'sent' ? 'primary-button' : 'secondary-button'}
                onClick={() => loadOffers('sent')}
              >
                Sent
              </button>
            </div>

            {offersLoading && <p>Loading offers...</p>}
            {offersError && <p className="error">{offersError}</p>}

            {!offersLoading && !offersError && offers.length === 0 && (
              <p>No offers found.</p>
            )}

            <div className="items-grid">
              {offers.map((offer) => (
                <article className="item-card" key={offer.id}>
                  <div className="item-info">
                    <h3>{offer.offered_title} ⇄ {offer.requested_title}</h3>

                    <p>
                      {offerBox === 'received' ? 'Offered by: ' : 'Sent to: '}
                      {offer.other_user}
                    </p>

                    <p>Status: {offer.status}</p>

                    {offer.status !== 'rejected' && (
                      <button
                        className="secondary-button"
                        onClick={() => openChat(offer.id)}
                      >
                        {activeChatOfferId === offer.id ? 'Refresh chat' : 'Open chat'}
                      </button>
                    )}

                    {offerBox === 'received' && offer.status === 'pending' && (
                      <div className="form-actions">
                        <button
                          className="primary-button"
                          disabled={updatingOffer === offer.id}
                          onClick={() => updateOffer(offer.id, 'accepted')}
                        >
                          {updatingOffer === offer.id ? 'Updating...' : 'Accept'}
                        </button>

                        <button
                          className="secondary-button"
                          disabled={updatingOffer === offer.id}
                          onClick={() => updateOffer(offer.id, 'rejected')}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {activeChatOfferId !== null && (
              <section className="chat-panel">
                <div className="chat-heading">
                  <div>
                    <h3>Conversation</h3>
                    <p>
                      {offers.find((offer) => offer.id === activeChatOfferId)
                        ? `${offers.find((offer) => offer.id === activeChatOfferId)?.offered_title} ⇄ ${offers.find((offer) => offer.id === activeChatOfferId)?.requested_title}`
                        : `Offer #${activeChatOfferId}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setActiveChatOfferId(null)
                      setMessages([])
                      setMessagesError('')
                    }}
                  >
                    Close
                  </button>
                </div>

                {messagesLoading && <p>Loading conversation...</p>}
                {messagesError && <p className="error">{messagesError}</p>}

                <div className="chat-messages" aria-live="polite">
                  {!messagesLoading && messages.length === 0 && !messagesError && (
                    <p className="chat-empty">No messages yet. Start the conversation.</p>
                  )}
                  {messages.map((message) => {
                    const mine = message.sender_id === user.id
                    return (
                      <article
                        className={`chat-message ${mine ? 'chat-message-mine' : 'chat-message-theirs'}`}
                        key={message.id}
                      >
                        <div className="chat-message-meta">
                          <strong>{mine ? 'You' : (message.sender_name || message.display_name || 'Other user')}</strong>
                          <time dateTime={message.created_at}>
                            {new Date(message.created_at).toLocaleString()}
                          </time>
                        </div>
                        <p>{message.body}</p>
                      </article>
                    )
                  })}
                </div>

                {offers.find((offer) => offer.id === activeChatOfferId)?.status === 'rejected' ? (
                  <p>This offer was rejected, so messaging is closed.</p>
                ) : (
                  <form className="chat-compose" onSubmit={sendMessage}>
                    <textarea
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      placeholder="Write a message..."
                      rows={2}
                      maxLength={1000}
                      required
                    />
                    <button
                      className="primary-button"
                      disabled={sendingMessage || !messageDraft.trim()}
                    >
                      {sendingMessage ? 'Sending...' : 'Send message'}
                    </button>
                  </form>
                )}
              </section>
            )}
          </section>
        ) : (
          <section className="marketplace">
            <div className="market-heading">
              <p className="eyebrow">THE COMMUNITY MARKETPLACE</p>
              <h2>Discover something new.</h2>
              <p>Find items you love and exchange them with the community.</p>
            </div>

            <div className="market-actions">
              <button
                className="primary-button add-item-button"
                onClick={() => {
                  setShowAddForm(!showAddForm)
                  setAddError('')
                }}
              >
                + Add an item
              </button>
            </div>

            {showAddForm && (
              <form className="add-item-form" onSubmit={handleAddItem}>
                <h3>List a new item</h3>

                <label>
                  Item title
                  <input
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder="e.g. Vintage camera"
                    required
                  />
                </label>

                <label>
                  Description
                  <textarea
                    value={newDescription}
                    onChange={(event) => setNewDescription(event.target.value)}
                    placeholder="Describe your item..."
                    rows={4}
                  />
                </label>

                <label>
                  Category
                  <select
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                  >
                    {categories.filter((item) => item.value !== '').map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Item image (optional)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      setNewImage(event.target.files?.[0] ?? null)
                    }
                  />
                </label>

                {addError && <p className="error">{addError}</p>}

                <div className="form-actions">
                  <button className="primary-button" disabled={adding}>
                    {adding ? 'Publishing...' : 'Publish item'}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="filters">
              <input
                className="search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search items..."
              />

              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {itemsLoading && <p>Loading marketplace...</p>}
            {itemsError && <p className="error">{itemsError}</p>}

            {!itemsLoading && !itemsError && items.length === 0 && (
              <div className="empty-state">
                <h3>No items found</h3>
                <p>Try another search or category. New listings will appear here.</p>
              </div>
            )}

            <div className="item-grid">
              {items.map((item) => (
                <article
                  className="item-card"
                  key={item.id}
                  onClick={() => openItem(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openItem(item.id)
                    }
                  }}
                >
                  <div className="item-placeholder">
                    {item.image_path ? (
                      <img
                        src={`/api${item.image_path.startsWith('/') ? '' : '/'}${item.image_path}`}
                        alt={item.title}
                      />
                    ) : (
                      <span>
                        {item.category === 'knjige' ? '📚' :
                          item.category === 'elektronika' ? '💻' :
                          item.category === 'oblacila' ? '👕' :
                          item.category === 'sport' ? '⚽' : '🏠'}
                      </span>
                    )}
                  </div>

                  <div className="item-details">
                    <span className="category-label">
                      {categories.find((c) => c.value === item.category)?.label
                        ?? item.category}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.description || 'No description provided.'}</p>
                    <span className="item-owner">
                      Listed by {item.owner_name}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    )
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>Barter<span>App</span></h1>
        <p>Trade things. Find treasures.</p>
      </header>

      <section className="auth-card">
        <p className="eyebrow">THE COMMUNITY MARKETPLACE</p>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="subtitle">
          {mode === 'login'
            ? 'Log in to discover what you can exchange.'
            : 'Join the community and start exchanging.'}
        </p>

        <div className="tabs">
          <button
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => { setMode('login'); setError('') }}
            type="button"
          >
            Log in
          </button>
          <button
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => { setMode('register'); setError('') }}
            type="button"
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="primary-button" disabled={loading}>
            {loading
              ? 'Please wait...'
              : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="footnote">BarterApp — exchange more, waste less.</p>
      </section>
    </main>
  )
}

export default App

