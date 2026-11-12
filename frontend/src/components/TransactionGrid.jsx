import React from 'react';
import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Eye } from 'lucide-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { StatusBadge } from './UI';

const currency = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
function StatusCell({ value }) { return <StatusBadge status={value || 'unknown'} />; }
function CustomerCell({ data }) { const name = data.customer?.name || data.customerName || 'Customer'; return <div className="table-customer"><span>{name.slice(0, 1)}</span><div>{name}<small>{data.customer?.email || data.email || ''}</small></div></div>; }
export default function TransactionGrid({ rows }) {
  const columnDefs = useMemo(() => [
    { headerName: 'Transaction', field: 'transactionId', valueGetter: p => p.data.id || p.data.transactionId || '—', minWidth: 145, cellClass: 'mono-id' },
    { headerName: 'Customer', field: 'customerName', valueGetter: p => p.data.customer?.name || p.data.customerName || 'Customer', cellRenderer: CustomerCell, minWidth: 175 },
    { headerName: 'Order ID', field: 'orderId', valueGetter: p => p.data.orderId || p.data.order?.id || '—', cellClass: 'mono-id', minWidth: 115 },
    { headerName: 'Amount', field: 'amount', valueFormatter: p => currency(p.value), sort: 'desc', minWidth: 110 },
    { headerName: 'Method', field: 'paymentMethod', valueGetter: p => p.data.paymentMethod || p.data.method || '—', minWidth: 105 },
    { headerName: 'Status', field: 'status', cellRenderer: StatusCell, minWidth: 115 },
    { headerName: 'Date', field: 'createdAt', valueGetter: p => p.data.createdAt || p.data.date || '', valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString() : '—', sort: 'desc', minWidth: 105 },
    { headerName: 'Actions', field: 'id', sortable: false, filter: false, width: 85, cellRenderer: () => <button className="icon-button" title="View transaction"><Eye size={15}/></button> }
  ], []);
  const defaultColDef = useMemo(() => ({ flex: 1, sortable: true, filter: true, resizable: true }), []);
  return <div className="ag-theme-quartz transaction-grid"><AgGridReact rowData={rows} columnDefs={columnDefs} defaultColDef={defaultColDef} pagination paginationPageSize={10} paginationPageSizeSelector={[10, 25, 50]} animateRows /></div>;
}
