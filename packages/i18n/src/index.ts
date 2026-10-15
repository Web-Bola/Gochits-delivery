/** All UI text is Georgian. Keep strings here, not in screens. Wording is ours, not official brand copy. */
export const ka = {
  appName: "Gochit's",
  login: { title: 'შესვლა', phone: 'ტელეფონის ნომერი', send: 'კოდის გაგზავნა', invalid: 'შეიყვანე 9-ნიშნა ნომერი' },
  otp: { title: 'შეიყვანე კოდი', confirm: 'დადასტურება', resend: 'ხელახლა გაგზავნა', wrong: 'კოდი არასწორია' },
  address: { title: 'მისამართი', street: 'ქუჩა და სახლის ნომერი', entrance: 'სადარბაზო', floor: 'სართული', apartment: 'ბინა', save: 'მისამართის შენახვა', outside: 'ამ მისამართზე მიტანა ჯერ არ არის', working: 'იძებნება...', locationDenied: 'მდებარეობაზე წვდომა არ არის დაშვებული', locationTimeout: 'მდებარეობა ვერ დადგინდა. სცადე თავიდან' },
  branch: { title: 'აირჩიე ფილიალი', nearest: 'უახლოესი', closed: 'ახლა დახურულია', fee: 'მიტანა', time: 'დრო', min: 'მინ.', see: 'მენიუს ნახვა', change: 'შეცვლა', hint: 'ღირებულებასა და დროს ანგარიშობს სერვერი' },
  menu: { search: 'მოძებნე მენიუში', unapprovedPrices: 'ფასები ნანახია Wolt-ზე (დიღმის ფილიალი) და დასადასტურებელია', add: 'დამატება' },
  cart: { title: 'კალათა', empty: 'კალათა ცარიელია', subtotal: 'პროდუქტები', checkout: 'გაფორმება' },
  checkout: { title: 'გაფორმება', place: 'შეკვეთის გაგზავნა', pay: 'გადახდა და შეკვეთა', notes: 'კომენტარი', payment: 'გადახდის მეთოდი', card: 'ბარათით (დემო)', cash: 'ნაღდი ანგარიშსწორება', cashOff: 'ამ ფილიალში ნაღდი ანგარიშსწორება ჩართული არ არის', delivery: 'მიტანა', total: 'ჯამი', deliveryServer: 'მიტანის ღირებულებას სერვერი ანგარიშობს' },
  payment: { title: 'გადახდა', banner: 'დემო რეჟიმი · რეალური გადახდა არ ხდება', note: 'ბარათის მონაცემები არ გვჭირდება და არ ინახება', success: 'გადახდის სიმულაცია: წარმატება', fail: 'გადახდის სიმულაცია: წარუმატებლობა', failedTitle: 'გადახდა ვერ შესრულდა', retry: 'თავიდან ცდა', demoOff: 'დემო რეჟიმი გამორთულია. რეალური გადახდა ჯერ არ არის დაკავშირებული' },
  tabs: { menu: 'მენიუ', orders: 'შეკვეთები', profile: 'პროფილი' },
  product: { qty: 'რაოდენობა', addFor: 'დამატება', noPhoto: 'ფოტო არ არის', notFound: 'პროდუქტი ვერ მოიძებნა' },
  orders: { title: 'ჩემი შეკვეთები', empty: 'შეკვეთები ჯერ არ გაქვს', emptyHint: 'აირჩიე რამე გემრიელი მენიუდან', toMenu: 'მენიუში გადასვლა', track: 'თვალყური' },
  order: { demoBanner: 'დემო რეჟიმი', demoNext: 'შემდეგი სტატუსი (დემო)', demoAuto: 'ავტომატური დემო', demoStop: 'გაჩერება', courier: 'კურიერი', courierHint: 'კურიერის აპი ჯერ არ არის დაკავშირებული', items: 'შეკვეთა', total: 'ჯამი', method: 'გადახდა', again: 'გამეორება', back: 'მენიუ' },
  profile: { title: 'პროფილი', name: 'სახელი', namePh: 'შეიყვანე სახელი', phone: 'ტელეფონი', save: 'შენახვა', saved: 'შენახულია ✓', addresses: 'ჩემი მისამართები', noAddresses: 'მისამართი ჯერ არ არის', use: 'არჩევა', delete: 'წაშლა', addNew: 'ახალი მისამართი', support: 'დახმარება', supportTxt: 'დახმარებისთვის დაგვიკავშირდი ტელეფონით', terms: 'წესები და კონფიდენციალურობა', termsTxt: 'იურიდიული ტექსტები მომზადდება იურისტის მიერ და გამოქვეყნდება გაშვებამდე', logout: 'გასვლა', deleteAccount: 'ანგარიშის წაშლა', deleteTxt: 'ანგარიშის წაშლა დემოში გამორთულია. რეალურ ვერსიაში მონაცემები წაიშლება კანონით დადგენილი წესით', version: 'დემო ვერსია' },
  common: { loading: 'იტვირთება...', retry: 'თავიდან ცდა', empty: '—' },
  errors: {
    generic: 'რაღაც შეფერხდა. სცადე თავიდან',
    branch_unavailable: 'ფილიალი ახლა შეკვეთებს არ იღებს',
    outside_zone: 'ეს მისამართი მიტანის ზონაში არ არის',
    fee_not_configured: 'მიტანის ღირებულება ჯერ არ არის დაყენებული',
    below_minimum: 'შეკვეთა მინიმალურ თანხაზე ნაკლებია',
    product_unavailable: 'ერთ-ერთი პროდუქტი ახლა მიუწვდომელია',
    cash_not_allowed: 'ამ ფილიალში ნაღდი ანგარიშსწორება ჩართული არ არის',
  },
} as const;

export function errorText(code: string): string {
  const e = ka.errors as Record<string, string>;
  return e[code] ?? ka.errors.generic;
}
