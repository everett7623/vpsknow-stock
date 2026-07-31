// DMIT WHMCS PID 配置模板
// 请访问 https://www.dmit.io 获取真实 PID 后填入

export const DMIT_PRODUCTS_WITH_PID = [
  {
    productId: 'dmit-pvm-lax-tiny',
    planName: 'PVM.LAX Tiny',
    location: 'Los Angeles',
    priceCents: 699,
    billingCycle: 'monthly',
    whmcsPid: null, // ⬅️ 待填入: 访问 dmit.io,点击此产品的 Order,查看 URL 中的 pid=xxx
    orderUrl: 'https://www.dmit.io/cart.php?a=add&pid=___', // 待补全
  },
  {
    productId: 'dmit-pvm-lax-mini',
    planName: 'PVM.LAX Mini',
    location: 'Los Angeles',
    priceCents: 1199,
    billingCycle: 'monthly',
    whmcsPid: null, // ⬅️ 待填入
    orderUrl: 'https://www.dmit.io/cart.php?a=add&pid=___',
  },
  {
    productId: 'dmit-pvm-hkg-tiny',
    planName: 'PVM.HKG Tiny',
    location: 'Hong Kong',
    priceCents: 1999,
    billingCycle: 'monthly',
    whmcsPid: null, // ⬅️ 待填入
    orderUrl: 'https://www.dmit.io/cart.php?a=add&pid=___',
  },
  {
    productId: 'dmit-pvm-hkg-mini',
    planName: 'PVM.HKG Mini',
    location: 'Hong Kong',
    priceCents: 3299,
    billingCycle: 'monthly',
    whmcsPid: null, // ⬅️ 待填入
    orderUrl: 'https://www.dmit.io/cart.php?a=add&pid=___',
  },
  {
    productId: 'dmit-pvm-tyo-tiny',
    planName: 'PVM.TYO Tiny',
    location: 'Tokyo',
    priceCents: 1999,
    billingCycle: 'monthly',
    whmcsPid: null, // ⬅️ 待填入
    orderUrl: 'https://www.dmit.io/cart.php?a=add&pid=___',
  },
  {
    productId: 'dmit-eyeball-lax-tiny',
    planName: 'Eyeball.LAX Tiny',
    location: 'Los Angeles',
    priceCents: 499,
    billingCycle: 'monthly',
    whmcsPid: null, // ⬅️ 待填入
    orderUrl: 'https://www.dmit.io/cart.php?a=add&pid=___',
  },
];

// 使用示例:
// 1. 访问 https://www.dmit.io
// 2. 找到 PVM.LAX Tiny 产品,点击 "Order Now"
// 3. 地址栏显示: https://www.dmit.io/cart.php?a=add&pid=123
// 4. 填入上面: whmcsPid: '123'
// 5. 重复步骤 1-4 获取所有产品的 PID
