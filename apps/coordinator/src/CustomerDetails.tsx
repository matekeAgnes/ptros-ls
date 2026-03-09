// apps/coordinator/src/CustomerDetails.tsx
export default function CustomerDetails() {
  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-4 sm:space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Customer Details
              </h1>
              <p className="mt-1 text-sm text-slate-600 sm:text-base">
                View customer profile, contact details, and delivery activity.
              </p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 sm:text-sm">
              Active Customer
            </span>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              Profile Information
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Full Name
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 sm:text-base">
                  Alex Johnson
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer ID
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 sm:text-base">
                  CUST-10245
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Phone
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 sm:text-base">
                  +1 (555) 234-9987
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Email
                </p>
                <p className="mt-1 break-words text-sm font-medium text-slate-900 sm:text-base">
                  alex.johnson@example.com
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Address
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 sm:text-base">
                  245 Market Street, San Francisco, CA 94105
                </p>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              Quick Stats
            </h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Total Orders
                </p>
                <p className="text-lg font-semibold text-slate-900">128</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Completed Deliveries
                </p>
                <p className="text-lg font-semibold text-slate-900">121</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Last Delivery
                </p>
                <p className="text-lg font-semibold text-slate-900">2 days ago</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
            Recent Activity
          </h2>
          <div className="mt-4 space-y-3">
            {[
              "Order #ORD-8841 assigned to carrier James M.",
              "Delivery #DLV-5572 completed successfully.",
              "Support request updated: Change delivery time.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
            >
              Contact Customer
            </button>
            <button
              type="button"
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
            >
              Create Delivery
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
