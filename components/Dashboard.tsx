
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Transaction, TransactionType, OverdueBook, OverdueReservation } from '../types';
import { isWithinInterval, subDays, startOfDay, format, addDays, parseISO } from 'date-fns';
import Card from './common/Card';
import { BookOpenIcon, UsersIcon, ArrowTrendingUpIcon, ExclamationTriangleIcon } from './icons';
import Modal from './common/Modal';

interface DashboardProps {
    transactions: Transaction[];
    totalBooks: number;
    totalMembers: number;
    activeLoans: number;
    overdueBooks: OverdueBook[];
    overdueReservations: OverdueReservation[];
    onExtendReservation: (reservationId: string, newPickupDate: string) => void;
    onCancelOverdueReservation: (reservationId: string) => void;
    onLogActivity: (action: string, details: string) => void;
}

const KpiCard: React.FC<{ title: string; value: number | string; icon: React.ReactNode; }> = ({ title, value, icon }) => (
    <Card className="flex items-center p-4">
        <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/50 mr-4">
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
        </div>
    </Card>
);

const OverdueNotice: React.FC<{ overdueBooks: OverdueBook[], onLogActivity: (action: string, details: string) => void }> = ({ overdueBooks, onLogActivity }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (overdueBooks.length === 0) return null;

    const toggleExpand = () => {
        const newState = !isExpanded;
        setIsExpanded(newState);
        if (newState) {
            onLogActivity('View Details', 'Expanded Overdue Books notice');
        }
    };

    return (
        <div className="bg-amber-100 dark:bg-amber-900/30 border-l-4 border-amber-500 text-amber-800 dark:text-amber-200 p-4 rounded-md shadow-md mb-6" role="alert">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-6 w-6 mr-3 text-amber-500" />
                    <p className="font-bold">
                        {overdueBooks.length} book{overdueBooks.length > 1 ? 's are' : ' is'} overdue.
                    </p>
                </div>
                <button 
                    onClick={toggleExpand}
                    className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                >
                    {isExpanded ? 'Hide Details' : 'View Details'}
                </button>
            </div>
            {isExpanded && (
                <div className="mt-4 pl-9 text-sm">
                    <ul className="list-disc space-y-2">
                        {overdueBooks.map((item, index) => (
                            <li key={index}>
                                <strong>{item.bookTitle}</strong> borrowed by {item.memberName} ({item.memberId}) is overdue by <strong>{item.daysOverdue} day{item.daysOverdue > 1 ? 's' : ''}</strong>. 
                                (Due: {format(item.dueDate, 'dd/MM/yyyy')})
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const OverdueReservationsNotice: React.FC<{ 
    overdueReservations: OverdueReservation[],
    onExtend: (reservationId: string, newPickupDate: string) => void,
    onCancel: (reservationId: string) => void,
    onLogActivity: (action: string, details: string) => void
}> = ({ overdueReservations, onExtend, onCancel, onLogActivity }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [reservationToExtend, setReservationToExtend] = useState<OverdueReservation | null>(null);
    const [newPickupDate, setNewPickupDate] = useState('');
    const [reservationToCancel, setReservationToCancel] = useState<OverdueReservation | null>(null);

    if (overdueReservations.length === 0) return null;

    const toggleExpand = () => {
        const newState = !isExpanded;
        setIsExpanded(newState);
        if (newState) {
            onLogActivity('View Details', 'Expanded Overdue Reservations notice');
        }
    };

    const handleOpenExtendModal = (res: OverdueReservation) => {
        setReservationToExtend(res);
        setNewPickupDate(format(addDays(new Date(), 2), 'yyyy-MM-dd'));
    };

    const handleConfirmExtend = () => {
        if (reservationToExtend) {
            onExtend(reservationToExtend.reservationId, newPickupDate);
            setReservationToExtend(null);
        }
    };
    
    const handleConfirmCancel = () => {
        if (reservationToCancel) {
            onCancel(reservationToCancel.reservationId);
            setReservationToCancel(null);
        }
    };

    return (
        <>
            <div className="bg-rose-100 dark:bg-rose-900/30 border-l-4 border-rose-500 text-rose-800 dark:text-rose-200 p-4 rounded-md shadow-md mb-6" role="alert">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <ExclamationTriangleIcon className="h-6 w-6 mr-3 text-rose-500" />
                        <p className="font-bold">
                            {overdueReservations.length} reservation{overdueReservations.length > 1 ? 's have' : ' has'} not been picked up.
                        </p>
                    </div>
                    <button 
                        onClick={toggleExpand}
                        className="text-sm font-medium text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100"
                    >
                        {isExpanded ? 'Hide Details' : 'View Details'}
                    </button>
                </div>
                {isExpanded && (
                    <div className="mt-4 pl-9 text-sm">
                        <ul className="space-y-3">
                            {overdueReservations.map((item) => (
                                <li key={item.reservationId} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 bg-rose-50 dark:bg-rose-800/20 rounded-md">
                                    <div>
                                        <strong>{item.bookTitle}</strong> for {item.memberName} ({item.memberId}).
                                        <br/>
                                        <span className="text-xs">Pickup was due: {format(parseISO(item.pickupDate), 'dd/MM/yyyy')}</span>
                                    </div>
                                    <div className="flex space-x-2 mt-2 sm:mt-0 self-end sm:self-center">
                                        <button onClick={() => handleOpenExtendModal(item)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Extend</button>
                                        <button onClick={() => setReservationToCancel(item)} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Cancel</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            
            <Modal
                isOpen={!!reservationToExtend}
                onClose={() => setReservationToExtend(null)}
                onConfirm={handleConfirmExtend}
                title="Extend Pickup Date"
                confirmText="Extend"
                confirmButtonClass="bg-blue-600 hover:bg-blue-700"
            >
                <div>
                    <p className="mb-2">Extend reservation for <strong>{reservationToExtend?.bookTitle}</strong> for member <strong>{reservationToExtend?.memberName}</strong>.</p>
                    <label htmlFor="new-pickup-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">New Pickup Date</label>
                    <input
                        type="date"
                        id="new-pickup-date"
                        value={newPickupDate}
                        onChange={(e) => setNewPickupDate(e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md"
                    />
                </div>
            </Modal>
            
            <Modal
                isOpen={!!reservationToCancel}
                onClose={() => setReservationToCancel(null)}
                onConfirm={handleConfirmCancel}
                title="Confirm Cancellation"
                confirmText="Cancel Reservation"
            >
                 <p>Are you sure you want to cancel the reservation for <strong>{reservationToCancel?.bookTitle}</strong> by <strong>{reservationToCancel?.memberName}</strong>?</p>
            </Modal>
        </>
    );
};

const processWeeklyData = (transactions: Transaction[], type: TransactionType) => {
    const today = startOfDay(new Date());
    const lastWeek = subDays(today, 6);
    
    const weeklyTransactions = transactions.filter(t => 
        t.type === type && isWithinInterval(new Date(t.date), { start: lastWeek, end: new Date() })
    );

    const dataByDay: { [key: string]: number } = {};
    for (let i = 0; i < 7; i++) {
        const day = subDays(today, i);
        const dayKey = format(day, 'EEE');
        dataByDay[dayKey] = 0;
    }

    weeklyTransactions.forEach(t => {
        const dayKey = format(new Date(t.date), 'EEE');
        if (dataByDay[dayKey] !== undefined) {
            dataByDay[dayKey]++;
        }
    });

    return Object.entries(dataByDay).map(([name, count]) => ({ name, count })).reverse();
};

const Dashboard: React.FC<DashboardProps> = ({ 
    transactions, 
    totalBooks, 
    totalMembers, 
    activeLoans, 
    overdueBooks, 
    overdueReservations,
    onExtendReservation,
    onCancelOverdueReservation,
    onLogActivity
}) => {

    const weeklyCheckouts = useMemo(() => processWeeklyData(transactions, TransactionType.CheckOut), [transactions]);
    const weeklyCheckins = useMemo(() => processWeeklyData(transactions, TransactionType.CheckIn), [transactions]);

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Library Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Welcome back, MAHSS_Librarian! Here's what's happening today.</p>

            <OverdueNotice overdueBooks={overdueBooks} onLogActivity={onLogActivity} />
            <OverdueReservationsNotice 
                overdueReservations={overdueReservations} 
                onExtend={onExtendReservation} 
                onCancel={onCancelOverdueReservation} 
                onLogActivity={onLogActivity}
            />

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <KpiCard title="Total Books" value={totalBooks} icon={<BookOpenIcon className="h-6 w-6 text-indigo-500" />} />
                <KpiCard title="Total Members" value={totalMembers} icon={<UsersIcon className="h-6 w-6 text-indigo-500" />} />
                <KpiCard title="Active Loans" value={activeLoans} icon={<ArrowTrendingUpIcon className="h-6 w-6 text-indigo-500" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Books Checked Out (Last 7 Days)">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={weeklyCheckouts} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="checkoutGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.7}/>
                                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ fill: 'rgba(79, 70, 229, 0.1)' }} 
                                contentStyle={{ 
                                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                                    border: '1px solid #334155',
                                    borderRadius: '0.75rem',
                                    color: '#f1f5f9'
                                }}
                                labelStyle={{ fontWeight: 'bold' }}
                            />
                            <Bar dataKey="count" fill="url(#checkoutGradient)" name="Checkouts" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
                <Card title="Books Checked In (Last 7 Days)">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={weeklyCheckins} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                             <defs>
                                <linearGradient id="checkinGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.7}/>
                                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.1}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ fill: 'rgba(22, 163, 74, 0.1)' }} 
                                contentStyle={{ 
                                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                                    border: '1px solid #334155',
                                    borderRadius: '0.75rem',
                                    color: '#f1f5f9'
                                }}
                                labelStyle={{ fontWeight: 'bold' }}
                            />
                            <Bar dataKey="count" fill="url(#checkinGradient)" name="Check-ins" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
