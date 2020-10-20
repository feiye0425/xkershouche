<?php
namespace app\index\controller;
use \think\Controller;
class Index extends Controller
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


       //通过分类id获取其下的新闻
        $news_fenlei = db('newsfenlei')->select();
        $array = array();
        foreach ($news_fenlei as $key => $value) {
            if($value['pid']==0){
               
                $children = getChildren($news_fenlei,$value['id']);// 假如是一级分类，获取id主键的所有儿子类，
                array_unshift($children, $value);//将子类添加到一级类的前面，组成一个新的数组。现在$value前面是子类，后面是自己；
                $ids = array_column($children, 'id');//重新组成一个id的单列数组
                $news = db('news')->where('pid','in',$ids)->select();
                $array[$key] = $children[0];
                $array[$key]['children'] = $news;
            }
        }
        $this->assign('news',$array);



        $bannerlist = db('banner')->select();
        $this->assign('bannerlist',$bannerlist);

        $all_fenlei = db('newsfenlei')->select();
        print_r($all_fenlei) ;

        $yiji_fenlei = $all_fenlei['0']['pid'=>0];
       
        $this->assign('all_fenlei',$all_fenlei);




         dump($all_fenlei);
        return view();



    }



}
