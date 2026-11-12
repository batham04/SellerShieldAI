import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BadgeDollarSign,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Filter,
  Lightbulb,
  MoreHorizontal,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import {
  Button,
  DataTable,
  EmptyState,
  LoadingSpinner,
  Modal,
  PageHeading,
  SearchInput,
  SectionHeader,
  StatCard,
  StatusBadge,
} from '../components/UI';
import TransactionGrid from '../components/TransactionGrid';
import { useAuth } from '../context/AuthContext';
import { getError, services } from '../services/api';

const money = value =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));

function useFetch(request, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    request()
      .then(response => setData(response.data))
      .catch(reason => setError(getError(reason)))
      .finally(() => setLoading(false));
  }, dependencies);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

export function OverviewPage() {
  const { data, loading, error, reload } = useFetch(
    () => services.analytics.overview({ range: '7d' }),
    []
  );
  const { user } = useAuth();
  const overview = data?.overview || data || {};
  const metrics = overview.metrics || overview;
  const transactions = overview.recentTransactions || overview.transactions || [];
  const products = overview.topProducts || [];

  return (
    <>
      <PageHeading
        eyebrow="YOUR BUSINESS, AT A GLANCE"
        title={`Good morning, ${(user?.name || 'there').split(' ')[0]}.`}
        description="Here’s what’s happening with your store today."
        action={
          <button className="date-select" type="button">
            <CalendarDays size={16} /> Last 7 days <ChevronDown size={15} />
          </button>
        }
      />

      {error && (
        <div className="dashboard-notice">
          <span><Activity size={16} /> Live dashboard data is unavailable.</span>
          <Button variant="ghost" onClick={reload}>Retry</Button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner label="Loading your business overview…" />
      ) : (
        <>
          <div className="stats-grid">
            <StatCard
              icon={BadgeDollarSign}
              label="Gross revenue"
              value={money(metrics.totalRevenue ?? metrics.revenue)}
              change={metrics.revenueChange || '—'}
              note="vs. previous 7 days"
            />
            <StatCard
              icon={ShoppingBag}
              label="Total orders"
              value={metrics.totalOrders ?? '—'}
              change={metrics.ordersChange || '—'}
              note="vs. previous 7 days"
            />
            <StatCard
              icon={CircleDollarSign}
              label="Successful payments"
              value={metrics.successfulPayments ?? '—'}
              change={metrics.paymentsChange || '—'}
              note="settled this period"
            />
            <StatCard
              icon={WalletCards}
              label="Pending payments"
              value={metrics.pendingPayments ?? '—'}
              change={metrics.refundRequests ?? '—'}
              trend="down"
              note="refund requests"
            />
          </div>

          <div className="dashboard-columns">
            <section className="panel revenue-panel">
              <SectionHeader
                title="Revenue over time"
                subtitle="A little momentum, every day."
                action={<button className="period-select" type="button">This week <ChevronDown size={14} /></button>}
              />
              <div className="chart-key">
                <span /> Revenue <strong>{money(metrics.totalRevenue || 0)}</strong>
                <small>this week</small>
              </div>
              <div className="revenue-chart">
                {data?.revenueSeries?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.revenueSeries}>
                      <defs>
                        <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7067ee" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#7067ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#f0f0f5" vertical={false} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={value => `$${value}`}
                        width={46}
                      />
                      <Tooltip formatter={value => money(value)} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#7167ec"
                        strokeWidth={2.5}
                        fill="url(#revGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-empty">
                    <div className="chart-empty-icon"><TrendingUp size={20} /></div>
                    <strong>No revenue series yet</strong>
                    <span>Connect analytics to see revenue over time.</span>
                  </div>
                )}
              </div>
            </section>

            <section className="panel insight-panel">
              <SectionHeader title="A little insight" subtitle="From your AI business copilot." />
              <div className="insight-feature">
                <div className="insight-sparkle"><Sparkles size={17} /></div>
                <span className="insight-label">SELLERSHIELD SUGGESTS</span>
                <h3>{overview.insights?.[0]?.title || 'Your next little win starts here.'}</h3>
                <p>
                  {overview.insights?.[0]?.description ||
                    'Connect analytics to receive suggestions for your store.'}
                </p>
              </div>
              <Link to="/seller/insights" className="insight-link">
                Explore AI insights <ArrowRight size={14} />
              </Link>
            </section>
          </div>

          <div className="dashboard-columns bottom-columns">
            <section className="panel top-products-panel">
              <SectionHeader
                title="Top little sellers"
                subtitle="Your most loved products this week."
                action={<Link className="panel-link" to="/seller/products">All products <ArrowRight size={14} /></Link>}
              />
              <div className="top-products-list">
                {products.length ? products.map((product, index) => (
                  <div className="top-product-row" key={product.id || product.name}>
                    <span className="rank">{String(index + 1).padStart(2, '0')}</span>
                    <img src={product.image} alt="" />
                    <div className="top-product-name">
                      <strong>{product.name}</strong>
                      <small>{product.sold ?? product.unitsSold ?? 0} sold</small>
                    </div>
                    <strong className="top-product-revenue">{money(product.revenue)}</strong>
                    <span className={`stock-indicator ${(product.stock ?? product.inventory ?? 0) < 10 ? 'low' : ''}`}>
                      ● {product.stock ?? product.inventory ?? 0} left
                    </span>
                  </div>
                )) : (
                  <div className="panel-empty">Top product performance appears when analytics are available.</div>
                )}
              </div>
            </section>

            <section className="panel transactions-preview">
              <SectionHeader
                title="Recent transactions"
                subtitle="A quick look at what’s coming through."
                action={<Link className="panel-link" to="/seller/transactions">View all <ArrowRight size={14} /></Link>}
              />
              {transactions.length ? (
                <div className="mini-transactions">
                  {transactions.slice(0, 4).map(transaction => (
                    <div key={transaction.id || transaction.transactionId}>
                      <div className="mini-avatar">
                        {(transaction.customer?.name || transaction.customerName || '?').slice(0, 1)}
                      </div>
                      <div className="mini-customer">
                        <strong>{transaction.customer?.name || transaction.customerName || 'Customer'}</strong>
                        <small>{transaction.id || transaction.transactionId}</small>
                      </div>
                      <StatusBadge status={transaction.status || transaction.paymentStatus || 'unknown'} />
                      <strong>{money(transaction.amount)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="panel-empty">Transactions appear here when the API returns recent activity.</div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

export function ProductsAdminPage() {
  const { data, loading, error, reload } = useFetch(() => services.products.list(), []);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: 'Home & Living',
    description: '',
    price: '',
    stock: '',
    image: '',
  });

  const products = Array.isArray(data) ? data : data?.products || [];
  const filteredProducts = products.filter(product =>
    `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase())
  );

  const openEditor = product => {
    setEditingProduct(product || null);
    setForm(product ? { ...product } : {
      name: '', category: 'Home & Living', description: '', price: '', stock: '', image: '',
    });
    setNotice('');
    setModalOpen(true);
  };

  const saveProduct = async event => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const body = { ...form, price: Number(form.price), stock: Number(form.stock) };
      if (editingProduct) {
        await services.products.update(editingProduct.id, body);
      } else {
        await services.products.create(body);
      }
      setModalOpen(false);
      reload();
    } catch (reason) {
      setNotice(getError(reason));
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async id => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    setNotice('');
    try {
      await services.products.remove(id);
      reload();
    } catch (reason) {
      setNotice(getError(reason));
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="YOUR CATALOG"
        title="The good stuff."
        description="Every thoughtful thing your shop has to offer."
        action={<Button onClick={() => openEditor()}><Plus size={16} /> Add a product</Button>}
      />
      {error && (
        <div className="dashboard-notice">
          <span>Live catalog unavailable. Product management needs a connected product API.</span>
          <Button variant="ghost" onClick={reload}>Retry</Button>
        </div>
      )}
      {notice && <div className="inline-error">{notice}</div>}

      <div className="toolbar">
        <SearchInput value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your products…" />
        <span className="toolbar-count">{products.length} products</span>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filteredProducts.length ? (
        <div className="admin-product-grid">
          {filteredProducts.map(product => (
            <article className="admin-product" key={product.id}>
              <div className="admin-product-img">
                <img src={product.image} alt={product.name} />
                <button className="admin-more" type="button" onClick={() => openEditor(product)} aria-label={`Edit ${product.name}`}>
                  <MoreHorizontal size={18} />
                </button>
              </div>
              <div className="admin-product-info">
                <div className="admin-product-category">{product.category}</div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div>
                  <strong>{money(product.price)}</strong>
                  <StatusBadge status={(product.stock ?? product.inventory) > 0 ? 'In stock' : 'Out of stock'} />
                </div>
                <small>{product.stock ?? product.inventory ?? 0} units available</small>
                <div className="admin-product-actions">
                  <Button variant="outline" onClick={() => openEditor(product)}>Edit product</Button>
                  <button className="remove-link" type="button" onClick={() => deleteProduct(product.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title={query ? 'No matching products' : 'A shelf full of possibility'}
          text={query ? 'Try another search.' : 'Add your first product to start building a catalog.'}
          action={!query && <Button onClick={() => openEditor()}><Plus size={15} /> Add first product</Button>}
        />
      )}

      {modalOpen && (
        <Modal title={editingProduct ? 'Edit product' : 'Add a product'} onClose={() => setModalOpen(false)}>
          {notice && <div className="inline-error">{notice}</div>}
          <form className="form-stack modal-form" onSubmit={saveProduct}>
            <label>
              Product name
              <input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
            </label>
            <div className="field-row">
              <label>
                Category
                <input required value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} />
              </label>
              <label>
                Price ($)
                <input type="number" min="0" step="0.01" required value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} />
              </label>
            </div>
            <label>
              Description
              <textarea required rows="3" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} />
            </label>
            <div className="field-row">
              <label>
                Stock
                <input type="number" min="0" required value={form.stock} onChange={event => setForm({ ...form, stock: event.target.value })} />
              </label>
              <label>
                Image URL
                <input type="url" value={form.image} onChange={event => setForm({ ...form, image: event.target.value })} placeholder="https://…" />
              </label>
            </div>
            <Button disabled={saving}>{saving ? 'Saving…' : editingProduct ? 'Save changes' : 'Create product'} <ArrowRight size={15} /></Button>
          </form>
        </Modal>
      )}
    </>
  );
}

function OrderWorkspace({ refund = false }) {
  const { data, loading, error, reload } = useFetch(
    () => refund ? services.refunds.list() : services.orders.list(),
    [refund]
  );
  const [query, setQuery] = useState('');
  const rows = Array.isArray(data)
    ? data
    : refund
      ? data?.refunds || data?.orders || []
      : data?.orders || [];

  const decideRefund = async (id, decision) => {
    try {
      await services.refunds.decide(id, decision);
      reload();
    } catch (reason) {
      window.alert(getError(reason));
    }
  };

  const columns = refund
    ? [
        { key: 'id', label: 'Order / case', render: row => <strong className="mono-id">{row.id || row.orderId}</strong> },
        { key: 'customer', label: 'Customer', render: row => row.customer?.name || row.customerName || '—' },
        { key: 'complaint', label: 'Customer complaint', render: row => row.complaint || row.reason || 'No complaint provided' },
        {
          key: 'aiRecommendation',
          label: 'AI recommendation',
          render: row => <div title={row.aiExplanation || row.aiReason || ''}><strong>{(row.aiRecommendation || row.recommendation || 'MANUAL_REVIEW').replaceAll('_', ' ')}</strong><small>{row.recommendationSource === 'groq' ? 'Groq analysis' : 'Rules based · AI unavailable'}</small></div>,
        },
        { key: 'analysis', label: 'Analysis', render: row => <div><span>{row.aiExplanation || 'No explanation provided.'}</span><small>{Math.round(Number(row.aiConfidence || 0) * 100)}% confidence · seller approval required</small>{row.policyReasons?.length > 0 && <small>{row.policyReasons.join(' ')}</small>}</div> },
        { key: 'amount', label: 'Amount', render: row => money(row.amount || row.total) },
        { key: 'status', label: 'Status', render: row => <StatusBadge status={row.refundStatus || row.status || 'Review needed'} /> },
        {
          key: 'actions',
          label: 'Review',
          render: row => (
            <div className="table-actions">
              <Button variant="small" onClick={() => decideRefund(row.id, 'approved')}>Approve &amp; process refund</Button>
              <Button variant="small-outline" onClick={() => decideRefund(row.id, 'rejected')}>Decline</Button>
            </div>
          ),
        },
      ]
    : [
        { key: 'id', label: 'Order', render: row => <strong className="mono-id">{row.id || row.orderId}</strong> },
        {
          key: 'customer',
          label: 'Customer',
          render: row => (
            <div className="table-customer">
              <span>{(row.customer?.name || row.customerName || 'C').slice(0, 1)}</span>
              <div>
                {row.customer?.name || row.customerName || 'Customer'}
                <small>{row.customer?.email || row.email || ''}</small>
              </div>
            </div>
          ),
        },
        { key: 'createdAt', label: 'Date', render: row => row.createdAt || row.date ? new Date(row.createdAt || row.date).toLocaleDateString() : '—' },
        { key: 'items', label: 'Items', render: row => row.items?.map(item => `${item.name} ×${item.quantity || 1}`).join(', ') || '—' },
        { key: 'paymentStatus', label: 'Payment', render: row => <StatusBadge status={row.paymentStatus || 'pending'} /> },
        { key: 'status', label: 'Order status', render: row => <StatusBadge status={row.status || 'pending'} /> },
        { key: 'total', label: 'Total', render: row => <strong>{money(row.total || row.amount)}</strong> },
      ];

  const filteredRows = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <PageHeading
        eyebrow={refund ? 'CUSTOMER CARE' : 'FULFILLMENT'}
        title={refund ? 'A little extra care.' : 'Orders, in good hands.'}
        description={refund
          ? 'Review refund requests with context and care. Decisions are sent to the backend for processing.'
          : 'A clear view of every order, customer and next step.'}
      />
      {error && (
        <div className="dashboard-notice">
          <span>{refund ? 'Refund request data' : 'Order data'} unavailable from backend.</span>
          <Button variant="ghost" onClick={reload}>Retry</Button>
        </div>
      )}
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={refund ? 'Search requests…' : 'Search orders or customers…'}
        />
        <button className="filter-button" type="button"><Filter size={15} /> Filters <ChevronDown size={14} /></button>
        <span className="toolbar-count">{rows.length} {refund ? 'requests' : 'orders'}</span>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : filteredRows.length ? (
        <div className="panel data-panel"><DataTable columns={columns} rows={filteredRows} /></div>
      ) : (
        <EmptyState
          icon={refund ? WalletCards : ShoppingBag}
          title={refund ? 'No refund requests' : 'No orders to show'}
          text={error ? 'Connect the API to load live data.' : 'New activity will appear here as soon as it arrives.'}
        />
      )}
    </>
  );
}

export function OrdersAdminPage() {
  return <OrderWorkspace />;
}

export function RefundsPage() {
  return (
    <>
      <OrderWorkspace refund />
      <div className="refund-footnote">
        <Lightbulb size={16} />
        <span>
          <strong>AI recommendations, human decisions.</strong>{' '}
          The assistant can offer context, but only a seller can approve a request. Approval sends it to the backend for PayPal processing.
        </span>
      </div>
    </>
  );
}

export function TransactionsPage() {
  const { data, loading, error, reload } = useFetch(() => services.payments.transactions(), []);
  const [query, setQuery] = useState('');
  const rows = Array.isArray(data) ? data : data?.transactions || [];
  const filteredRows = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  const settledTotal = rows
    .filter(row => ['success', 'paid', 'completed'].includes(String(row.status).toLowerCase()))
    .reduce((total, row) => total + Number(row.amount || 0), 0);
  const pendingCount = rows.filter(row => String(row.status).toLowerCase() === 'pending').length;

  return (
    <>
      <PageHeading
        eyebrow="PAYMENT ACTIVITY"
        title="Every dollar, accounted for."
        description="Transaction activity from your connected payment providers."
      />
      {error && (
        <div className="dashboard-notice">
          <span>Live transaction data is unavailable.</span>
          <Button variant="ghost" onClick={reload}>Retry</Button>
        </div>
      )}
      <div className="transaction-summary">
        <div><span><Check size={15} /></span><div><small>Settled this month</small><strong>{data ? money(settledTotal) : '—'}</strong></div></div>
        <div><span className="amber"><Activity size={15} /></span><div><small>In progress</small><strong>{data ? pendingCount : '—'}</strong></div></div>
        <div><span className="purple"><CreditCard size={15} /></span><div><small>Total transactions</small><strong>{data ? rows.length : '—'}</strong></div></div>
      </div>
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search transaction, order or customer…"
        />
        <span className="toolbar-count">{rows.length} transactions</span>
      </div>
      <div className="panel data-panel">
        {loading
          ? <LoadingSpinner label="Loading transactions…" />
          : <TransactionGrid rows={filteredRows} />}
      </div>
    </>
  );
}

export function InsightsPage() {
  const { data, loading, error, reload } = useFetch(
    () => services.ai.businessInsights({ range: '30d' }),
    []
  );
  const insights = data?.insights || data?.overview?.insights || [];

  return (
    <>
      <PageHeading
        eyebrow="YOUR AI BUSINESS COPILOT"
        title="Ideas for what’s next."
        description="Small, thoughtful suggestions grounded in your store’s activity."
        action={<Button variant="outline" onClick={reload}><Sparkles size={15} /> Refresh insights</Button>}
      />
      {error && (
        <div className="dashboard-notice">
          <span>Personalized insights need live analytics data.</span>
          <Button variant="ghost" onClick={reload}>Retry</Button>
        </div>
      )}
      {data?.summary && <div className="panel insight-summary"><p>{data.summary}</p><small>Based on {data.statistics?.capturedPayments || 0} verified captured payments · {data.statistics?.rangeDays || 30} day analysis</small></div>}
      {loading ? (
        <LoadingSpinner label="Listening to your store…" />
      ) : insights.length ? (
        <div className="insights-grid">
          {insights.map((insight, index) => (
            <article className="insight-card" key={insight.id || index}>
              <div className="insight-card-top">
                <div className="insight-sparkle"><Sparkles size={17} /></div>
                <span>{insight.category || 'OPPORTUNITY'}</span>
              </div>
              <h2>{insight.title}</h2>
              <p>{insight.description}</p>
              {insight.metricKey && <div className="insight-impact"><TrendingUp size={15} /> Verified {insight.metricKey.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}: {insight.metricKey.toLowerCase().includes('revenue') || insight.metricKey.toLowerCase().includes('refundedamount') ? money(insight.metricValue) : insight.metricKey === 'repeatCustomerRate' ? `${(Number(insight.metricValue) * 100).toFixed(1)}%` : Number(insight.metricValue).toLocaleString()}</div>}
              {insight.actionLabel && <span className="text-link">{insight.actionLabel} <ArrowRight size={14} /></span>}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title={data?.status === 'insufficient_data' ? 'Verified sales data is not available yet' : 'No verifiable AI insights returned'}
          text={data?.status === 'insufficient_data' ? 'Insights will appear after completed payments have been recorded.' : 'Refresh after confirming GROQ_API_KEY and recent seller analytics are available.'}
        />
      )}
    </>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => services.settings.get(), []);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (data) setForm(data.settings || data);
  }, [data]);

  const saveSettings = async event => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      await services.settings.update(form);
      setNotice('Your settings have been saved.');
    } catch (reason) {
      setNotice(getError(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="YOUR STORE, YOUR WAY"
        title="A little personal touch."
        description="Store details and preferences, all in one place."
      />
      {error && (
        <div className="dashboard-notice">
          <span>Settings service unavailable. Changes can’t be saved until connected.</span>
          <Button variant="ghost" onClick={reload}>Retry</Button>
        </div>
      )}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <form className="settings-form" onSubmit={saveSettings}>
          <div className="panel settings-panel">
            <SectionHeader title="Seller profile" subtitle="The person behind the shop." />
            <div className="settings-fields">
              <label>Your name<input value={form.name ?? user?.name ?? ''} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
              <label>Email address<input type="email" value={form.email ?? user?.email ?? ''} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
            </div>
          </div>
          <div className="panel settings-panel">
            <SectionHeader title="Store details" subtitle="How the world sees your little corner of the internet." />
            <div className="settings-fields">
              <label>Store name<input value={form.storeName || ''} onChange={event => setForm({ ...form, storeName: event.target.value })} /></label>
              <label>Website<input value={form.website || ''} onChange={event => setForm({ ...form, website: event.target.value })} placeholder="https://yourstore.com" /></label>
              <label className="full-field">A short hello<textarea rows="3" value={form.description || ''} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
            </div>
          </div>
          <div className="panel settings-panel">
            <SectionHeader title="Refund policy" subtitle="Set the expectations for customer care." />
            <div className="settings-fields">
              <label>
                Return window
                <select value={form.returnWindow || '30 days'} onChange={event => setForm({ ...form, returnWindow: event.target.value })}>
                  <option>14 days</option><option>30 days</option><option>60 days</option><option>Final sale</option>
                </select>
              </label>
              <label className="check-setting">
                <input type="checkbox" checked={Boolean(form.acceptReturns)} onChange={event => setForm({ ...form, acceptReturns: event.target.checked })} />
                Accept return requests
              </label>
            </div>
          </div>
          {notice && <div className={notice.includes('saved') ? 'success-notice' : 'inline-error'}>{notice}</div>}
          <Button disabled={saving}>{saving ? 'Saving…' : 'Save changes'} <Check size={15} /></Button>
        </form>
      )}
    </>
  );
}
