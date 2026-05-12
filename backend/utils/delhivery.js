async function createShipment(order) {
  const token = process.env.DELHIVERY_TOKEN;
  const pickupName = process.env.DELHIVERY_PICKUP_NAME;

  if (!token) throw new Error('DELHIVERY_TOKEN not configured');
  if (!pickupName) throw new Error('DELHIVERY_PICKUP_NAME not configured');

  const isCod = order.payment_method === 'COD';
  const totalRupees = String(order.total_paise / 100);
  const address = [order.address.line1, order.address.line2].filter(Boolean).join(', ');

  const data = {
    shipments: [{
      name: order.customer_name,
      add: address,
      pin: order.address.pin_code,
      city: order.address.city,
      state: order.address.state,
      country: 'India',
      phone: order.customer_phone,
      order: order.id,
      payment: isCod ? 'COD' : 'Prepaid',
      products_desc: 'Saree',
      cod_amount: isCod ? totalRupees : '0',
      order_date: order.created_at_utc,
      total_amount: totalRupees,
      seller_add: "Zohra's House, Hyderabad",
      seller_name: 'Poshakh',
      seller_inv: order.id,
      quantity: '1',
      waybill: '',
      shipment_width: '30',
      shipment_height: '5',
      weight: '0.5',
      seller_gst_tin: '',
      shipping_mode: 'Surface',
      address_type: 'home',
    }],
    pickup_location: { name: pickupName },
  };

  const params = new URLSearchParams({ format: 'json', data: JSON.stringify(data) });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch('https://track.delhivery.com/api/cmu/create.json', {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: controller.signal,
    });

    const json = await res.json();
    const pkg = json.packages && json.packages[0];

    if (!pkg || pkg.status !== 'Success' || !pkg.waybill) {
      throw new Error(pkg ? pkg.remarks || 'Delhivery shipment creation failed' : 'Empty response from Delhivery');
    }

    return {
      awb: pkg.waybill,
      label_url: `https://track.delhivery.com/api/p/packing_slip?wbns=${pkg.waybill}&token=${token}`,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('Delhivery request timed out after 5s');
    } else {
      console.error('Delhivery shipment creation failed:', err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { createShipment };
