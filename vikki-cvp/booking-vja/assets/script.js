let activeTab = 'VN';

const dataVN = {
  sapa: {
    title: 'Sapa',
    description:
      'Bay cùng Vietjet đến Sapa, hòa mình vào<br/>núi rừng mát lạnh, tận hưởng mùa hè<br/>giữa mây trời và bản làng độc đáo.',
    href: 'https://vikkibank.vn/du-lich-sapa/',
    img: './assets/1.png',
  },
  danang: {
    title: 'Đà Nẵng',
    description:
      'Bay ngay cùng Vietjet đến Đà Nẵng, vi vu biển xanh, <br/>cầu Vàng nổi tiếng, Bà Nà Hills <br/>và ẩm thực đậm chất miền Trung',
    href: 'https://vikkibank.vn/du-lich-da-nang/',
    img: './assets/2.png',
  },
  phuquoc: {
    title: 'Phú Quốc',
    description:
      'Đặt vé Vietjet đến Phú Quốc, tận hưởng nắng vàng biển xanh<br/>và khám phá Sunset Sanato.',
    href: 'https://vikkibank.vn/du-lich-phu-quoc/',
    img: './assets/3.png',
  },
};

const dataQT = {
  sydney: {
    title: 'Sydney',
    description:
      'Cùng Vietjet bay đến Sydney, chiêm ngưỡng nhà hát Con Sò,<br/>tắm biển Bondi và khám phá ẩm thực xứ sở Kangaroo.',
    href: 'https://vikkibank.vn/du-lich-sydney/',
    img: './assets/4.png',
  },
  tokyo: {
    title: 'Tokyo',
    description:
      'Bay ngay Tokyo với Vietjet, dạo phố Shibuya,<br/>thưởng thức sushi tươi ngon và khám phá văn hóa Nhật đặc sắc.',
    href: 'https://vikkibank.vn/du-lich-tokyo/',
    img: './assets/5.png',
  },
  singapore: {
    title: 'Singapore',
    description:
      'Vi vu Singapore cùng Vietjet, check-in <br/>Gardens by the Bay, dạo phố Orchard<br/>và thưởng thức ẩm thực đa sắc màu.',
    href: 'https://vikkibank.vn/du-lich-singapore/',
    img: './assets/6.png',
  },
};

const $slides = $('.center').slick({
  centerMode: true,
  centerPadding: '0px',
  slidesToShow: 3,
  focusOnSelect: true,
  infinite: true,
  arrows: true,
  dots: true,
  responsive: [
    {
      breakpoint: 550,
      settings: {
        slidesToShow: 1,
        slidesToScroll: 1,
        centerPadding: '100px',
      },
    },
  ],
});

function updateTextWithFade(selector, newText) {
  const el = document.querySelector(selector);

  // Fade out
  gsap.to(el, {
    duration: 0.3,
    opacity: 0,
    onComplete: () => {
      el.innerHTML = newText;

      // Fade in
      gsap.to(el, {
        duration: 0.5,
        opacity: 1,
        ease: 'power2.out',
      });
    },
  });
}

function changeImageWithGSAP(newSrc) {
  const img = document.getElementById('mainImage');

  // Fade out
  gsap.to(img, {
    duration: 0.4,
    opacity: 0,
    scale: 1,
    filter: 'blur(4px)',
    onComplete: () => {
      img.src = newSrc;
      img.onload = () => {
        gsap.fromTo(
          img,
          { opacity: 0, scale: 1.05, filter: 'blur(4px)' },
          { duration: 0.4, opacity: 1, scale: 1, filter: 'blur(0px)' }
        );
      };
    },
  });
}

function addData(currentData) {
  const data = `<h2>${currentData?.title}</h2>
  <p>
  ${currentData?.description}
  </p>
  <span data-href="${currentData?.href}" class="btn-discover"></span>`;
  $(`.main-content`).html(data);
  changeImageWithGSAP(currentData?.img);
  $('.main-content').css('opacity', 1);
}
$slides.on('beforeChange', function (event, slick, currentSlide, nextSlide) {
  const index =
    typeof currentSlide === 'undefined' ? slick.nextSlide : nextSlide;
  const $currentSlide = $(slick.$slides[index]);
  const key = $currentSlide.data('key');

  const currentData = activeTab === 'VN' ? dataVN[key] : dataQT[key];
  addData(currentData);
});

$slides.on('afterChange', function (event, slick, currentSlide, nextSlide) {});

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tablinks');
  const contents = document.querySelectorAll('.tabcontent');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');

      contents.forEach((content) => {
        gsap.to(content, {
          opacity: 0,
          height: 0,
          zIndex: 0,
          duration: 0.5,
          onComplete: () => {
            content.classList.remove('active');
          },
        });
      });

      const targetContent = document.getElementById(targetId);
      targetContent.classList.add('active');
      gsap.fromTo(
        targetContent,
        { opacity: 0 },
        { opacity: 1, zIndex: 2, height: 'auto', duration: 0.5 }
      );

      tabs.forEach((t) => {
        t.classList.remove('active');
      });
      tab.classList.add('active');

      const isVietnam = tab.id === 'vn-tab';
      isVietnam ? (activeTab = 'VN') : (activeTab = 'QT');
      let key = 'sapa';
      if (activeTab === 'VN') {
        key = $('#tab-1').find('.slick-current').data('key');
      } else {
        key = $('#tab-2').find('.slick-current').data('key');
      }

      const currentData = activeTab === 'VN' ? dataVN[key] : dataQT[key];

      addData(currentData);

      // Animate tab sliding
      gsap.to('#vn-tab .tab-text', {
        x: isVietnam ? 84 : 20,
        duration: 0.5,
        ease: 'power1.out',
      });
      gsap.to('#qt-tab .tab-text', {
        x: !isVietnam ? 55 : 0,
        duration: 0.5,
        ease: 'power1.out',
      });
    });
  });

  tabs[0].click();
});
