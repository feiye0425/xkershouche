<?php
namespace app\index\controller;
use \think\Controller;
class Index2 extends Controller
{
    public function index()
    {
        $brand_select = db('brand')->where('pid',0)->order('order desc')->select();

        $cars_model = model('\app\admin\model\Cars');
        foreach ($brand_select as $key => $value) {
            $cars_select = $cars_model->where('brand_level1',$value['id'])->select();
            foreach ($cars_select as $key1 => $value1) {
                $value1->carsimg;
            }
            $cars_select = $cars_select->toArray();
            $brand_select[$key]['children'] = $cars_select;

        }

        $this->assign('brand_select',$brand_select);
        // dump($brand_select);
        $list = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O',
        'P','Q','R','S','T','U','V','W','X','Y','Z'];
        $arr = array();
        foreach ($list as $key => $value) {
            foreach ($brand_select as $key1 => $value1) {
                if($value1['initial']==$value){
                    $arr[$value][] = $value1;
                }
            }
        }
        $this->assign('brand_list',$arr);

        $level_select = db('level')->select();
        $this->assign('level',$level_select);

        $current_year = date('Y',time());
        $arr = array();
        for ($i=0; $i < 10; $i++) {
            $arr[$i] = $current_year-$i;
        }
        $this->assign('years',$arr);


       //通过分类id获取其下的新闻列表
        $news_fenlei = db('newsfenlei')->select();

        $wenda = db('newsfenlei')->select();



        $array = array();
        $array_wenda = array();




        foreach ($news_fenlei as $key => $value) {
            if($value['pid']==0){
            


                $children = getChildren($news_fenlei,$value['id']);
               // 现在从foreach之前的所有数组中，找到这两条数组中获取id主键的所有儿子类，

                array_unshift($children, $value);
                //将父类添加到子类的前面，组成一个新的数组。现在这两条$value前面是自己，后面是子类；



                $ids = array_column($children, 'id');//额外组成一个id的单列数组ids

                $news = db('news')->where('pid','in',$ids)->select();//获取所有父类是在ids组中的数组


      
                $wenda = db('wenda')->where('pid','in',$ids)->select();


                $array[$key] = $children[0];
                $array[$key]['children'] = $news;

                $array_weda[$key] = $children[0];
                $array_wenda[$key]['children'] = $wenda;



/*$new_detail = db('news')->where('id','in',$news)->select();//获取所有父类是在ids组中的数组*/


            }
        }

      /*  dump($array[0]['children']['2']['content']);*/

$qqq= array();

foreach ($wenda as $keykk => $valuekk) {

$aa = $valuekk['keywords_w'];

$keywordstt = '备孕';


    if(strstr( $aa, $keywordstt) !== false ){
        
        array_push($qqq, $valuekk);

    }

       

        

}













        $first_fenlei = $array['1']['children'];

/*$first_fenleictn = strip_tags($first_fenlei['content']);
*/
/*$aa= array();
foreach ($first_fenlei as $key1 => $value1) {
   $each_ctn = $value1['content'];
   $q= array($each_ctn);
   $aa=  array_merge($aa, $q);
};*/

      

        $wenda_fenlei = $array_wenda['6']['children'];

        $wenda_fenlei2 = $qqq;
      /*  $User = model($wenda_fenlei);
*/
/*        $map = [['keywords','like','备孕%'], ['title','like','备孕'],];
        $User->where($map)->select();
            dump($User);*/

/*        $news_title = array_column($first_fenlei, 'title');
         $this->assign('news_title',$news_title);*/

         $this->assign('first_fenlei',$first_fenlei);
         $this->assign('wenda_fenlei',$wenda_fenlei);

   $this->assign('wenda_fenlei2',$wenda_fenlei2);

        $cate_select = db('newsfenlei')->order('id')->select();
        $cate_model = model('cate');
        $cate_list = $cate_model->getChildren($cate_select);

        $this->assign('cate_list',$cate_list);

        $post = request()->post();

$c=array($post);

      


            return view();











    }

        function azixun(){
            return view();
        }
           



        function cs(){
  



        }
}
