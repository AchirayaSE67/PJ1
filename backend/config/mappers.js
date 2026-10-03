function mapCustomer(row) {
  if (!row) return null;
  return {
    customerId: row.customer_id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    timeBalanceMinutes: row.time_balance_minutes,
    createdAt: row.created_at
  };
}

function mapComputer(row) {
  if (!row) return null;
  const remaining = row.remaining_seconds != null ? Number(row.remaining_seconds) : null;
  return {
    computerId: row.computer_id,
    computerCode: row.computer_code,
    cpu: row.cpu,
    ram: row.ram,
    gpu: row.gpu,
    storage: row.storage,
    pricePerHour: Number(row.price_per_hour),
    status: row.status,
    remainingSeconds: remaining != null && remaining > 0 ? remaining : 0,
    connectionAddress: row.connection_address,
    connectionPort: row.connection_port,
    connectionMethod: row.connection_method,
    activeRentalId: row.active_rental_id || null,
    activeCustomerName: row.active_customer_name || null,
    activeStartTime: row.active_start_time || null,
    activeEndTime: row.active_end_time || null,
    rentalCount: Number(row.rental_count || 0),
    ratingAvg: Number(row.rating_avg || 0)
  };
}

function mapRental(row) {
  if (!row) return null;
  return {
    rentalId: row.rental_id,
    reservationId: row.reservation_id,
    customerId: row.customer_id,
    computerId: row.computer_id,
    computerCode: row.computer_code,
    startTime: row.start_time,
    endTime: row.end_time,
    hours: Number(row.hours),
    price: Number(row.price),
    status: row.status,
    remainingMinutes: row.remaining_minutes,
    remainingSeconds: row.remaining_seconds != null ? Number(row.remaining_seconds) : null,
    createdAt: row.created_at,
    connectionEnabled: row.connection_enabled === 1 || row.connection_enabled === true,
    connectionAddress: row.connection_address,
    connectionPort: row.connection_port,
    connectionMethod: row.connection_method
  };
}

module.exports = { mapCustomer, mapComputer, mapRental };
